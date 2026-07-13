import type { BeadCell } from './imageAnalysis'
import { getContrastTextColor } from './colorMatch'
import { drawBeadGrid, getBeadGridWorldSize } from './beadGridCanvas'
import {
  SHEET_GRID_BG,
  SHEET_DOC_RADIUS,
  SHEET_EXPORT_MARGIN,
  SHEET_GRID_INSET,
  LEGEND_PAD,
  SHEET_HEADER_H,
  SHEET_NOTCH_R,
  SHEET_TEXT,
} from '../constants/sheetLayout'
import type { ColorUsage } from '../types'

export {
  SHEET_GRID_BG,
  SHEET_GRID_INSET,
  SHEET_DOC_RADIUS,
  SHEET_EXPORT_MARGIN,
} from '../constants/sheetLayout'

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

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotationDeg: number,
  mirrorX = false,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((rotationDeg * Math.PI) / 180)
  if (mirrorX) ctx.scale(-1, 1)
  const s = size / 64
  ctx.scale(s, s)
  ctx.beginPath()
  ctx.moveTo(8, 56)
  ctx.bezierCurveTo(8, 24, 32, 4, 60, 6)
  ctx.bezierCurveTo(58, 36, 38, 58, 8, 56)
  ctx.closePath()
  ctx.fillStyle = '#8ac68a'
  ctx.fill()
  ctx.strokeStyle = '#3d5a1a'
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(14, 50)
  ctx.bezierCurveTo(26, 40, 40, 26, 56, 12)
  ctx.strokeStyle = '#3d5a1a'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.restore()
}

function drawFlower(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  petal: string,
) {
  ctx.save()
  ctx.translate(x, y)
  const s = size / 32
  ctx.scale(s, s)
  for (const rot of [0, 72, 144, 216, 288]) {
    ctx.save()
    ctx.rotate((rot * Math.PI) / 180)
    ctx.beginPath()
    ctx.ellipse(0, -8, 5, 7, 0, 0, Math.PI * 2)
    ctx.fillStyle = petal
    ctx.fill()
    ctx.strokeStyle = '#725d42'
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.restore()
  }
  ctx.beginPath()
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2)
  ctx.fillStyle = '#f7cd67'
  ctx.fill()
  ctx.strokeStyle = '#725d42'
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.restore()
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fill: string,
) {
  const pts = [
    [12, 2],
    [14.5, 9],
    [22, 9.5],
    [16, 14.5],
    [18, 22],
    [12, 17.5],
    [6, 22],
    [8, 14.5],
    [2, 9.5],
    [9.5, 9],
  ]
  ctx.save()
  ctx.translate(x - size / 2, y - size / 2)
  const s = size / 24
  ctx.scale(s, s)
  ctx.beginPath()
  pts.forEach(([px, py], i) => {
    if (i === 0) ctx.moveTo(px!, py!)
    else ctx.lineTo(px!, py!)
  })
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = '#725d42'
  ctx.lineWidth = 1.4
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.restore()
}

function drawDotTexture(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 0.14,
) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.fillStyle = `rgba(114, 93, 66, ${alpha})`
  for (let py = y; py < y + h; py += 14) {
    for (let px = x; px < x + w; px += 14) {
      ctx.beginPath()
      ctx.arc(px, py, 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawScissors(ctx: CanvasRenderingContext2D, x: number, y: number, size = 11) {
  const s = size / 24
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.strokeStyle = '#725d42'
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.arc(6, 6, 2.4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(6, 18, 2.4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(8, 7.5)
  ctx.lineTo(21, 17)
  ctx.moveTo(8, 16.5)
  ctx.lineTo(21, 7)
  ctx.stroke()
  ctx.restore()
}

function drawTearHint(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const text = '沿虚线剪开'
  ctx.font = '700 10px Nunito, "Noto Sans SC", sans-serif'
  const tw = ctx.measureText(text).width + text.length * 1.2
  const icon = 11
  const gap = 5
  const padX = 12
  const h = 18
  const w = padX * 2 + icon + gap + tw + gap + icon

  roundRectPath(ctx, cx - w / 2, cy - h / 2, w, h, 12)
  ctx.fillStyle = '#f7f3df'
  ctx.fill()
  ctx.strokeStyle = 'rgba(114, 93, 66, 0.3)'
  ctx.lineWidth = 1.2
  ctx.stroke()

  const leftIconX = cx - w / 2 + padX
  const rightIconX = cx + w / 2 - padX - icon
  drawScissors(ctx, leftIconX, cy - icon / 2, icon)
  drawScissors(ctx, rightIconX, cy - icon / 2, icon)

  ctx.fillStyle = '#9a835a'
  ctx.font = '700 10px Nunito, "Noto Sans SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, cy)
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
  const chipH = 24
  let cx = x
  let cy = y
  let col = 0

  for (const item of usages) {
    const hidden = hiddenColors.has(item.color.tag)
    const bg = item.color.hex
    const r = chipH / 2
    ctx.fillStyle = hidden ? '#ececec' : bg
    roundRectPath(ctx, cx, cy, chipW, chipH, r)
    ctx.fill()
    ctx.strokeStyle = 'rgba(114, 93, 66, 0.18)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    const textColor = hidden ? '#999' : getContrastTextColor(bg)
    ctx.fillStyle = textColor
    ctx.font = '700 10px Nunito, "Noto Sans SC", sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(item.color.tag, cx + 8, cy + chipH / 2)

    ctx.font = '600 10px Nunito, "Noto Sans SC", sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(String(item.count), cx + chipW - 8, cy + chipH / 2)

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
  const docW = Math.max(320, gridSize.width + SHEET_GRID_INSET * 2)
  const legendInnerW = docW - LEGEND_PAD * 2
  const legendRows = Math.max(
    1,
    Math.ceil(Math.max(options.colorUsages.length, 1) / Math.max(1, Math.floor(legendInnerW / 94))),
  )
  const legendContentH = legendRows * 30 - 6
  // 与虚线框上下留白一致
  const stubPad = 20
  const lotteryH = stubPad + legendContentH + stubPad
  const gridPairGap = 8
  const gridSectionH = SHEET_GRID_INSET * 2 + gridSize.height * 2 + gridPairGap
  const bodyH = headerH + gridSectionH
  const docH = bodyH + lotteryH

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

  // Envelope body
  roundRectPath(ctx, docX, docY, docW, docH, SHEET_DOC_RADIUS)
  ctx.save()
  ctx.clip()

  const bodyGrad = ctx.createRadialGradient(
    docX + docW * 0.2,
    docY + docH * 0.1,
    0,
    docX + docW * 0.2,
    docY + docH * 0.1,
    docW * 0.7,
  )
  bodyGrad.addColorStop(0, 'rgba(248, 166, 178, 0.18)')
  bodyGrad.addColorStop(1, 'rgba(248, 166, 178, 0)')
  ctx.fillStyle = 'rgb(247, 243, 223)'
  ctx.fillRect(docX, docY, docW, docH)
  ctx.fillStyle = bodyGrad
  ctx.fillRect(docX, docY, docW, docH)

  const greenGrad = ctx.createRadialGradient(
    docX + docW * 0.8,
    docY + docH * 0.55,
    0,
    docX + docW * 0.8,
    docY + docH * 0.55,
    docW * 0.65,
  )
  greenGrad.addColorStop(0, 'rgba(138, 198, 138, 0.16)')
  greenGrad.addColorStop(1, 'rgba(138, 198, 138, 0)')
  ctx.fillStyle = greenGrad
  ctx.fillRect(docX, docY, docW, docH)

  drawDotTexture(ctx, docX, docY, docW, bodyH, 0.12)

  // Lottery stub background（纯色，无点状背景）
  const lotteryY = docY + bodyH
  ctx.fillStyle = 'rgb(247, 243, 223)'
  ctx.fillRect(docX, lotteryY, docW, lotteryH)
  ctx.fillStyle = 'rgba(61, 52, 40, 0.08)'
  ctx.fillRect(docX, lotteryY, docW, 4)

  ctx.restore()

  // Soft outer border（真实描边，保证圆角有色）
  roundRectPath(ctx, docX, docY, docW, docH, SHEET_DOC_RADIUS)
  ctx.strokeStyle = 'rgba(114, 93, 66, 0.12)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Punch tear notches
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  for (const nx of [docX, docX + docW]) {
    ctx.beginPath()
    ctx.arc(nx, lotteryY, SHEET_NOTCH_R, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // 裁剪半圆描边（冲孔后补回边框色）
  ctx.strokeStyle = 'rgba(114, 93, 66, 0.12)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(docX, lotteryY, SHEET_NOTCH_R, -Math.PI / 2, Math.PI / 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(docX + docW, lotteryY, SHEET_NOTCH_R, Math.PI / 2, (Math.PI * 3) / 2)
  ctx.stroke()

  ctx.save()
  ctx.translate(docX, docY)

  // 装饰放在网格之下、且避开网格区域（标题栏两侧 / 左右窄边）
  drawFlower(ctx, 30, 38, 22, '#f8a6b2')
  drawFlower(ctx, docW - 30, 40, 18, '#ecdf52')
  drawStar(ctx, 48, headerH - 6, 12, '#82d5bb')
  drawStar(ctx, docW - 52, headerH - 8, 14, '#f7cd67')
  drawFlower(ctx, 14, headerH + SHEET_GRID_INSET + 24, 16, '#b77dee')
  drawStar(ctx, docW - 14, headerH + SHEET_GRID_INSET + 48, 11, '#f7cd67')

  // Dashed inner border (body)
  ctx.strokeStyle = 'rgba(114, 93, 66, 0.35)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 4])
  roundRectPath(ctx, 10, 10, docW - 20, bodyH - 16, 18)
  ctx.stroke()
  ctx.setLineDash([])

  // 票根区外边框：与上方软边同色 + 虚线内框
  ctx.strokeStyle = 'rgba(114, 93, 66, 0.12)'
  ctx.lineWidth = 2
  roundRectPath(ctx, 8, bodyH + 6, docW - 16, lotteryH - 12, 18)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(114, 93, 66, 0.35)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 4])
  roundRectPath(ctx, 10, bodyH + 8, docW - 20, lotteryH - 16, 18)
  ctx.stroke()
  ctx.setLineDash([])

  // Title
  ctx.fillStyle = SHEET_TEXT
  ctx.font = '800 14px Nunito, "Noto Sans SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(options.title, docW / 2, 28)

  // Banner divider
  const bannerY = 44
  const grad = ctx.createLinearGradient(docW / 2 - 80, 0, docW / 2 + 80, 0)
  grad.addColorStop(0, 'transparent')
  grad.addColorStop(0.5, '#725d42')
  grad.addColorStop(1, 'transparent')
  ctx.strokeStyle = grad
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(docW / 2 - 80, bannerY)
  ctx.lineTo(docW / 2 - 14, bannerY)
  ctx.moveTo(docW / 2 + 14, bannerY)
  ctx.lineTo(docW / 2 + 80, bannerY)
  ctx.stroke()
  drawStar(ctx, docW / 2, bannerY, 14, '#f7cd67')

  // Grid + horizontal mirror（后画，盖住任何落到网格上的装饰）
  const gridX = SHEET_GRID_INSET
  const gridY = headerH + SHEET_GRID_INSET
  const gridOpts = {
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
    fourSideLabels: true as const,
    guideLineEvery: showGrid ? 10 : 0,
    showGrid,
    showCellLabels,
    backgroundColor: SHEET_GRID_BG,
  }
  ctx.save()
  ctx.translate(gridX, gridY)
  drawBeadGrid(ctx, gridOpts)
  ctx.restore()

  ctx.save()
  ctx.translate(gridX, gridY + gridSize.height + gridPairGap)
  drawBeadGrid(ctx, { ...gridOpts, mirrorX: true })
  ctx.restore()

  // Tear hint on cut line + color chips only
  drawTearHint(ctx, docW / 2, bodyH)

  drawLegend(
    ctx,
    options.colorUsages,
    options.hiddenColors,
    LEGEND_PAD,
    bodyH + stubPad,
    legendInnerW,
  )

  ctx.restore()

  // Corner leaves (outside clip so they sit on corners)
  drawLeaf(ctx, docX - 4, docY - 4, 48, -25)
  drawLeaf(ctx, docX + docW + 4, docY - 4, 48, 115, true)
  drawLeaf(ctx, docX - 4, docY + docH + 4, 48, -115)
  drawLeaf(ctx, docX + docW + 4, docY + docH + 4, 48, 25, true)

  // Soft drop shadow under document (drawn before would be covered — skip, leaves provide depth)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('导出失败')

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = options.filename ?? '拼豆图纸.png'
  link.click()
  URL.revokeObjectURL(url)
}
