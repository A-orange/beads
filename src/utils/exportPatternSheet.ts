import type { BeadCell } from './imageAnalysis'
import { getContrastTextColor } from './colorMatch'
import { drawBeadGrid, getBeadGridWorldSize } from './beadGridCanvas'
import {
  SHEET_PRIMARY,
  SHEET_GRID_BG,
  SHEET_DOC_BORDER,
  SHEET_DOC_RADIUS,
  SHEET_EXPORT_MARGIN,
  SHEET_GRID_INSET,
  LEGEND_PAD,
  SHEET_HEADER_H,
} from '../constants/sheetLayout'
import type { ColorUsage } from '../types'

export {
  SHEET_PRIMARY,
  SHEET_GRID_BG,
  SHEET_GRID_INSET,
  SHEET_DOC_RADIUS,
  SHEET_EXPORT_MARGIN,
}

export interface ExportPatternSheetOptions {
  title: string
  rows: number
  cols: number
  cells: BeadCell[]
  hiddenColors: Set<string>
  backgroundColors: Set<string>
  colorUsages: ColorUsage[]
  cellSize?: number
  showGrid?: boolean
  showCellLabels?: boolean
  filename?: string
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  usages: ColorUsage[],
  hiddenColors: Set<string>,
  x: number,
  y: number,
  width: number,
) {
  const minChipW = 88
  const gap = 6
  const cols = Math.max(1, Math.floor((width + gap) / (minChipW + gap)))
  const chipW = (width - gap * (cols - 1)) / cols
  const chipH = 22
  let cx = x
  let cy = y
  let col = 0

  for (const item of usages) {
    const hidden = hiddenColors.has(item.color.tag)
    const bg = item.color.hex
    ctx.fillStyle = hidden ? '#ececec' : bg
    ctx.fillRect(cx, cy, chipW, chipH)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)'
    ctx.lineWidth = 1
    ctx.strokeRect(cx + 0.5, cy + 0.5, chipW - 1, chipH - 1)

    const textColor = hidden ? '#999' : getContrastTextColor(bg)
    ctx.fillStyle = textColor
    ctx.font = '700 10px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(item.color.tag, cx + 6, cy + chipH / 2)

    ctx.font = '600 10px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(String(item.count), cx + chipW - 6, cy + chipH / 2)

    col++
    if (col >= cols) {
      col = 0
      cx = x
      cy += chipH + gap
    } else {
      cx += chipW + gap
    }
  }

  return cy + (col > 0 ? chipH : 0) - y
}

export async function exportPatternSheet(options: ExportPatternSheetOptions) {
  const cellSize = options.cellSize ?? 16
  const showGrid = options.showGrid ?? true
  const showCellLabels = options.showCellLabels ?? true
  const gridSize = getBeadGridWorldSize(options.rows, options.cols, cellSize, { fourSideLabels: true })

  const headerH = SHEET_HEADER_H
  const docW = gridSize.width + SHEET_GRID_INSET * 2
  const legendInnerW = docW - LEGEND_PAD * 2
  const legendRows = Math.ceil(options.colorUsages.length / Math.max(1, Math.floor(legendInnerW / 94)))
  const legendContentH = Math.max(0, legendRows * 28 - 6)
  const legendH = LEGEND_PAD * 2 + legendContentH
  const gridSectionH = SHEET_GRID_INSET * 2 + gridSize.height
  const docH = headerH + gridSectionH + legendH

  const totalW = docW + SHEET_EXPORT_MARGIN * 2
  const totalH = docH + SHEET_EXPORT_MARGIN * 2

  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = totalW * scale
  canvas.height = totalH * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')

  ctx.scale(scale, scale)
  ctx.clearRect(0, 0, totalW, totalH)

  const docX = SHEET_EXPORT_MARGIN
  const docY = SHEET_EXPORT_MARGIN

  ctx.fillStyle = SHEET_PRIMARY
  ctx.beginPath()
  ctx.roundRect(docX, docY, docW, docH, SHEET_DOC_RADIUS)
  ctx.fill()
  ctx.strokeStyle = SHEET_DOC_BORDER
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.save()
  ctx.translate(docX, docY)

  ctx.fillStyle = '#fff'
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(options.title, docW / 2, headerH / 2)

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(LEGEND_PAD, headerH)
  ctx.lineTo(docW - LEGEND_PAD, headerH)
  ctx.stroke()

  const gridX = SHEET_GRID_INSET
  const gridY = headerH + SHEET_GRID_INSET

  ctx.save()
  ctx.translate(gridX, gridY)
  drawBeadGrid(ctx, {
    rows: options.rows,
    cols: options.cols,
    cells: options.cells,
    hiddenColors: options.hiddenColors,
    backgroundColors: options.backgroundColors,
    cellSize,
    viewportW: gridSize.width,
    viewportH: gridSize.height,
    translateX: 0,
    translateY: 0,
    scale: 1,
    fourSideLabels: true,
    guideLineEvery: showGrid ? 10 : 0,
    showGrid,
    showCellLabels,
    backgroundColor: SHEET_GRID_BG,
  })
  ctx.restore()

  drawLegend(
    ctx,
    options.colorUsages,
    options.hiddenColors,
    LEGEND_PAD,
    headerH + gridSectionH + LEGEND_PAD,
    legendInnerW,
  )

  ctx.restore()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('导出失败')

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = options.filename ?? '拼豆图纸.png'
  link.click()
  URL.revokeObjectURL(url)
}
