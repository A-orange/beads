import type { BeadCell } from './imageAnalysis'
import { getContrastTextColor } from './colorMatch'
import { isBackgroundCell } from './beadColorRoles'

const HIDDEN_FILL = '#ececec'
const EMPTY_FILL = '#e8e8e8'
const HEADER_BG = '#f5f7fa'
const HEADER_TEXT = '#606266'
const OUTER_BORDER = '#c4a882'
const INNER_BORDER = 'rgba(0, 0, 0, 0.08)'

export interface BeadGridLayoutOptions {
  fourSideLabels?: boolean
}

export interface BeadGridWorldSize {
  width: number
  height: number
  headerSize: number
  gridOffsetX: number
  gridOffsetY: number
}

export function getBeadGridWorldSize(
  rows: number,
  cols: number,
  cellSize: number,
  layout: BeadGridLayoutOptions = {},
): BeadGridWorldSize {
  const headerSize = cellSize
  const gridW = headerSize + cols * cellSize
  const gridH = headerSize + rows * cellSize
  if (layout.fourSideLabels) {
    return {
      width: gridW + headerSize,
      height: gridH + headerSize,
      headerSize,
      gridOffsetX: headerSize,
      gridOffsetY: headerSize,
    }
  }
  return {
    width: gridW,
    height: gridH,
    headerSize,
    gridOffsetX: headerSize,
    gridOffsetY: headerSize,
  }
}

function buildCellMap(cells: BeadCell[]) {
  const map = new Map<string, BeadCell>()
  for (const cell of cells) {
    map.set(`${cell.row}-${cell.col}`, cell)
  }
  return map
}

export interface VisibleRange {
  rowStart: number
  rowEnd: number
  colStart: number
  colEnd: number
  headerColStart: number
  headerColEnd: number
  headerRowStart: number
  headerRowEnd: number
}

export function getVisibleRange(
  viewportW: number,
  viewportH: number,
  translateX: number,
  translateY: number,
  scale: number,
  rows: number,
  cols: number,
  cellSize: number,
  headerSize: number,
  padding = 1,
): VisibleRange {
  if (scale <= 0 || rows <= 0 || cols <= 0) {
    return {
      rowStart: 0,
      rowEnd: -1,
      colStart: 0,
      colEnd: -1,
      headerColStart: 0,
      headerColEnd: -1,
      headerRowStart: 0,
      headerRowEnd: -1,
    }
  }

  const inv = 1 / scale
  const wx0 = -translateX * inv
  const wy0 = -translateY * inv
  const wx1 = (viewportW - translateX) * inv
  const wy1 = (viewportH - translateY) * inv

  const colStart = Math.max(0, Math.floor((wx0 - headerSize) / cellSize) - padding)
  const colEnd = Math.min(cols - 1, Math.ceil((wx1 - headerSize) / cellSize) + padding)
  const rowStart = Math.max(0, Math.floor((wy0 - headerSize) / cellSize) - padding)
  const rowEnd = Math.min(rows - 1, Math.ceil((wy1 - headerSize) / cellSize) + padding)

  const headerColStart = Math.max(0, Math.floor((wx0 - headerSize) / cellSize) - padding)
  const headerColEnd = Math.min(cols - 1, Math.ceil((wx1 - headerSize) / cellSize) + padding)
  const headerRowStart = Math.max(0, Math.floor((wy0 - headerSize) / cellSize) - padding)
  const headerRowEnd = Math.min(rows - 1, Math.ceil((wy1 - headerSize) / cellSize) + padding)

  return {
    rowStart,
    rowEnd,
    colStart,
    colEnd,
    headerColStart,
    headerColEnd,
    headerRowStart,
    headerRowEnd,
  }
}

export interface DrawBeadGridOptions {
  rows: number
  cols: number
  cells: BeadCell[]
  hiddenColors: Set<string>
  backgroundColors?: Set<string>
  selectedCells?: Set<string>
  cellSize: number
  viewportW: number
  viewportH: number
  translateX: number
  translateY: number
  scale: number
  fourSideLabels?: boolean
  guideLineEvery?: number
  showGrid?: boolean
  showCellLabels?: boolean
  backgroundColor?: string
  /** 水平翻转色块布局，文字保持正向可读 */
  mirrorX?: boolean
}

export function hitTestBeadCell(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  options: {
    rows: number
    cols: number
    cellSize: number
    translateX: number
    translateY: number
    scale: number
  },
): { row: number; col: number } | null {
  const { rows, cols, cellSize, translateX, translateY, scale } = options
  if (scale <= 0 || rows <= 0 || cols <= 0) return null

  const { headerSize } = getBeadGridWorldSize(rows, cols, cellSize)
  const gridOffsetX = headerSize
  const gridOffsetY = headerSize
  const localX = (clientX - containerRect.left - translateX) / scale
  const localY = (clientY - containerRect.top - translateY) / scale

  if (localX < gridOffsetX || localY < gridOffsetY) return null

  const col = Math.floor((localX - gridOffsetX) / cellSize)
  const row = Math.floor((localY - gridOffsetY) / cellSize)

  if (row < 0 || row >= rows || col < 0 || col >= cols) return null
  return { row, col }
}

export function drawBeadGrid(ctx: CanvasRenderingContext2D, options: DrawBeadGridOptions) {
  const { rows, cols, cells, hiddenColors, selectedCells, cellSize, viewportW, viewportH } = options
  const backgroundColors = options.backgroundColors ?? new Set<string>()
  if (rows <= 0 || cols <= 0 || !cells.length) return

  const fourSide = options.fourSideLabels ?? false
  const guideEvery = options.guideLineEvery ?? 0
  const showGrid = options.showGrid ?? true
  const showCellLabels = options.showCellLabels ?? true
  const mirrorX = options.mirrorX ?? false
  const sheetBg = options.backgroundColor ?? '#fff'
  const { headerSize, width, height, gridOffsetX, gridOffsetY } = getBeadGridWorldSize(
    rows,
    cols,
    cellSize,
    { fourSideLabels: fourSide },
  )
  const gridW = gridOffsetX + cols * cellSize
  const gridH = gridOffsetY + rows * cellSize
  const cellMap = buildCellMap(cells)
  const range = getVisibleRange(
    viewportW,
    viewportH,
    options.translateX,
    options.translateY,
    options.scale,
    rows,
    cols,
    cellSize,
    headerSize,
  )

  ctx.save()
  ctx.translate(options.translateX, options.translateY)
  ctx.scale(options.scale, options.scale)

  ctx.fillStyle = sheetBg
  ctx.fillRect(0, 0, width, height)

  if (range.rowStart <= range.rowEnd && range.colStart <= range.colEnd) {
    const labelMinCell = 12
    const fontSize = Math.max(6, Math.floor(cellSize * 0.38))

    for (let row = range.rowStart; row <= range.rowEnd; row++) {
      for (let col = range.colStart; col <= range.colEnd; col++) {
        const srcCol = mirrorX ? cols - 1 - col : col
        const x = gridOffsetX + col * cellSize
        const y = gridOffsetY + row * cellSize
        const cell = cellMap.get(`${row}-${srcCol}`)
        const isBackground = cell ? isBackgroundCell(cell.color.tag, backgroundColors) : false
        const hidden = cell ? hiddenColors.has(cell.color.tag) : false

        ctx.fillStyle = isBackground ? sheetBg : hidden ? HIDDEN_FILL : cell ? cell.color.hex : EMPTY_FILL
        ctx.fillRect(x, y, cellSize, cellSize)

        if (cell && !isBackground && selectedCells?.has(`${row}-${srcCol}`)) {
          ctx.fillStyle = 'rgba(95, 160, 68, 0.38)'
          ctx.fillRect(x, y, cellSize, cellSize)
          ctx.strokeStyle = '#4a7c23'
          ctx.lineWidth = Math.max(2, 2 / options.scale)
          ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1)
        }

        if (cell && !isBackground && !hidden && showCellLabels && cellSize >= labelMinCell) {
          ctx.fillStyle = getContrastTextColor(cell.color.hex)
          ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(cell.color.tag, x + cellSize / 2, y + cellSize / 2)
        }
      }
    }
  }

  if (guideEvery > 0 && showGrid) {
    ctx.save()
    ctx.strokeStyle = '#d32f2f'
    ctx.lineWidth = Math.max(1.5, 2 / options.scale)
    ctx.setLineDash([5 / options.scale, 4 / options.scale])
    for (let col = guideEvery; col < cols; col += guideEvery) {
      const visualCol = mirrorX ? cols - col : col
      const x = gridOffsetX + visualCol * cellSize
      ctx.beginPath()
      ctx.moveTo(x, gridOffsetY)
      ctx.lineTo(x, gridH)
      ctx.stroke()
    }
    for (let row = guideEvery; row < rows; row += guideEvery) {
      const y = gridOffsetY + row * cellSize
      ctx.beginPath()
      ctx.moveTo(gridOffsetX, y)
      ctx.lineTo(gridW, y)
      ctx.stroke()
    }
    ctx.restore()
  }

  ctx.fillStyle = HEADER_BG
  ctx.fillRect(0, 0, width, headerSize)
  ctx.fillRect(0, 0, headerSize, height)
  if (fourSide) {
    ctx.fillRect(0, gridH, width, headerSize)
    ctx.fillRect(gridW, 0, headerSize, height)
  }

  const headerFont = Math.max(7, Math.floor(cellSize * 0.45))
  ctx.fillStyle = HEADER_TEXT
  ctx.font = `600 ${headerFont}px -apple-system, BlinkMacSystemFont, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (range.headerColStart <= range.headerColEnd) {
    for (let col = range.headerColStart; col <= range.headerColEnd; col++) {
      const srcCol = mirrorX ? cols - 1 - col : col
      const x = gridOffsetX + col * cellSize + cellSize / 2
      ctx.fillText(String(srcCol + 1), x, headerSize / 2)
      if (fourSide) {
        ctx.fillText(String(srcCol + 1), x, gridH + headerSize / 2)
      }
    }
  }

  if (range.headerRowStart <= range.headerRowEnd) {
    for (let row = range.headerRowStart; row <= range.headerRowEnd; row++) {
      const y = gridOffsetY + row * cellSize + cellSize / 2
      ctx.fillText(String(row + 1), headerSize / 2, y)
      if (fourSide) {
        ctx.fillText(String(row + 1), gridW + headerSize / 2, y)
      }
    }
  }

  if (showGrid) {
    ctx.strokeStyle = INNER_BORDER
    ctx.lineWidth = 1 / options.scale
    ctx.beginPath()

    if (range.colStart <= range.colEnd) {
      for (let col = range.colStart; col <= range.colEnd + 1; col++) {
        const x = gridOffsetX + col * cellSize
        ctx.moveTo(x, gridOffsetY)
        ctx.lineTo(x, gridH)
      }
    }

    if (range.rowStart <= range.rowEnd) {
      for (let row = range.rowStart; row <= range.rowEnd + 1; row++) {
        const y = gridOffsetY + row * cellSize
        ctx.moveTo(gridOffsetX, y)
        ctx.lineTo(gridW, y)
      }
    }

    ctx.stroke()
  }

  ctx.strokeStyle = OUTER_BORDER
  ctx.lineWidth = 2 / options.scale
  ctx.strokeRect(0, 0, width, height)

  ctx.restore()
}
