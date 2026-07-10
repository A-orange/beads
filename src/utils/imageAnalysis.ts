import { matchBeadColorFromSamples } from './colorMatch'
import type { BeadColor } from '../data/beadColor'

export type { BeadColor }

export interface BeadCell {
  row: number
  col: number
  color: BeadColor
}

export interface GridAlignment {
  /** 网格原点偏移（编辑器内容坐标） */
  offsetX: number
  offsetY: number
  /** 单格宽高（编辑器内容坐标） */
  cellWidth: number
  cellHeight: number
  /** 图片平移（编辑器内容坐标） */
  imageOffsetX: number
  imageOffsetY: number
  /** 图片缩放 */
  imageScale: number
  /** 网格视觉缩放（未锁定双指缩放时与图片同步，不改变格子宽高数值） */
  gridScale: number
  /** 编辑器内图片显示基准宽（imgScale=1 时，对应 natural 坐标换算） */
  displayWidth: number
  /** 编辑器内图片显示基准高 */
  displayHeight: number
}

export interface AnalysisResult {
  rows: number
  cols: number
  cells: BeadCell[]
}

/** 格子内采样内缩比例，避开边缘邻格与中心文字 */
const CELL_SAMPLE_INSET = 0.22

function readImageData(image: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法创建画布')
  ctx.drawImage(image, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

function readPixelRgb(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): [number, number, number] {
  const px = Math.max(0, Math.min(width - 1, Math.round(x)))
  const py = Math.max(0, Math.min(height - 1, Math.round(y)))
  const i = (py * width + px) * 4
  return [data[i]!, data[i + 1]!, data[i + 2]!]
}

function contentToNatural(
  cx: number,
  cy: number,
  image: HTMLImageElement,
  alignment: GridAlignment,
): [number, number] {
  const displayW = alignment.displayWidth || image.clientWidth || image.naturalWidth
  const displayH = alignment.displayHeight || image.clientHeight || image.naturalHeight
  const localX = (cx - alignment.imageOffsetX) / alignment.imageScale
  const localY = (cy - alignment.imageOffsetY) / alignment.imageScale
  return [
    localX * (image.naturalWidth / displayW),
    localY * (image.naturalHeight / displayH),
  ]
}

function sampleCellColorsFromContent(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  image: HTMLImageElement,
  alignment: GridAlignment,
  x0: number,
  y0: number,
  cellW: number,
  cellH: number,
): Array<[number, number, number]> {
  const insetX = cellW * CELL_SAMPLE_INSET
  const insetY = cellH * CELL_SAMPLE_INSET
  const midX = x0 + cellW / 2
  const midY = y0 + cellH / 2

  const points: Array<[number, number]> = [
    [x0 + insetX, y0 + insetY],
    [x0 + cellW - insetX, y0 + insetY],
    [x0 + insetX, y0 + cellH - insetY],
    [x0 + cellW - insetX, y0 + cellH - insetY],
    [midX, y0 + insetY],
    [midX, y0 + cellH - insetY],
    [x0 + insetX, midY],
    [x0 + cellW - insetX, midY],
  ]

  return points.map(([cx, cy]) => {
    const [nx, ny] = contentToNatural(cx, cy, image, alignment)
    return readPixelRgb(data, width, height, nx, ny)
  })
}

/** 按用户设置的行列数与网格位置，从整张图采样分析 */
export function analyzeAlignedGrid(
  image: HTMLImageElement,
  rows: number,
  cols: number,
  alignment: GridAlignment,
): AnalysisResult {
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error('图片尚未加载完成')
  }
  if (rows < 1 || cols < 1) {
    throw new Error('请先设置有效的行列数')
  }
  if (alignment.cellWidth < 0.01 || alignment.cellHeight < 0.01) {
    throw new Error('请先设置有效的格子宽高')
  }

  const { data, width, height } = readImageData(image)
  const scale = alignment.gridScale ?? 1
  const cellW = alignment.cellWidth * scale
  const cellH = alignment.cellHeight * scale
  const cells: BeadCell[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = alignment.offsetX + col * cellW
      const y0 = alignment.offsetY + row * cellH
      const samples = sampleCellColorsFromContent(
        data,
        width,
        height,
        image,
        alignment,
        x0,
        y0,
        cellW,
        cellH,
      )
      cells.push({
        row,
        col,
        color: matchBeadColorFromSamples(samples),
      })
    }
  }

  if (cells.length === 0) {
    throw new Error('未能识别有效颜色')
  }

  return { rows, cols, cells }
}

/** @deprecated 保留类型兼容 */
export interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}
