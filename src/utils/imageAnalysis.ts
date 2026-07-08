import { pixelate, snap } from 'fast-pixelizer'
import { matchMardColor } from './colorMatch'
import { estimateBeadGridSize, isPlausibleBeadGrid } from './gridDetection'
import { cropImageData, expandRegion, trimVerticalMargins } from './regionTrim'
import type { MardColor } from '../data/mard221'

export interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

export interface BeadCell {
  row: number
  col: number
  color: MardColor
}

export interface AnalysisResult {
  rows: number
  cols: number
  cells: BeadCell[]
  trimmed: boolean
}

function cellsFromImageData(
  data: Uint8ClampedArray,
  cols: number,
  rows: number,
): BeadCell[] {
  const cells: BeadCell[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = (row * cols + col) * 4
      cells.push({
        row,
        col,
        color: matchMardColor(data[i]!, data[i + 1]!, data[i + 2]!),
      })
    }
  }

  return cells
}

function resolveGridSize(
  width: number,
  height: number,
  pattern: ImageData,
): { cols: number; rows: number } {
  const snapped = snap(pattern, { colorVariety: 80, output: 'resized' })
  const snapGrid = { cols: snapped.width, rows: snapped.height }

  if (isPlausibleBeadGrid(width, height, snapGrid.cols, snapGrid.rows)) {
    return snapGrid
  }

  const estimated = estimateBeadGridSize(pattern.data, pattern.width, pattern.height)

  if (isPlausibleBeadGrid(width, height, estimated.cols, estimated.rows)) {
    return estimated
  }

  // snap 结果格子过大（如 32×32 对应 ~24px/格），优先用约束估算
  const snapCellSize = Math.max(width / snapGrid.cols, height / snapGrid.rows)
  const estCellSize = Math.max(width / estimated.cols, height / estimated.rows)

  if (snapCellSize > estCellSize) {
    return estimated
  }

  return snapGrid
}

function preparePattern(image: HTMLImageElement, selection: SelectionRect, skipTrim = false) {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法创建画布')

  ctx.drawImage(image, 0, 0)

  const expanded = expandRegion(selection, image.naturalWidth, image.naturalHeight, skipTrim ? 0 : 0.05)
  const selected = ctx.getImageData(expanded.x, expanded.y, expanded.width, expanded.height)

  if (skipTrim) {
    return { pattern: selected, trimmed: false }
  }

  const trimmedRegion = trimVerticalMargins(selected.data, selected.width, selected.height)
  const trimmed = trimmedRegion.height < selected.height * 0.92
  const pattern = cropImageData(selected.data, selected.width, trimmedRegion)

  return { pattern, trimmed }
}

export function detectGridFromSelection(
  image: HTMLImageElement,
  selection: SelectionRect,
): { rows: number; cols: number; trimmed: boolean } {
  const { pattern, trimmed } = preparePattern(image, selection)
  const grid = resolveGridSize(pattern.width, pattern.height, pattern)
  return { rows: grid.rows, cols: grid.cols, trimmed }
}

export interface AnalyzeOptions {
  rows?: number
  cols?: number
}

export function analyzeGrid(
  image: HTMLImageElement,
  selection: SelectionRect,
  options?: AnalyzeOptions,
): AnalysisResult {
  const manualRows = options?.rows ?? 0
  const manualCols = options?.cols ?? 0
  const useManual = manualRows > 0 && manualCols > 0

  const { pattern, trimmed } = preparePattern(image, selection, useManual)

  const grid = useManual
    ? { cols: manualCols, rows: manualRows }
    : resolveGridSize(pattern.width, pattern.height, pattern)

  const pixelated = pixelate(pattern, {
    resolution: { cols: grid.cols, rows: grid.rows },
    mode: 'detail',
    output: 'resized',
  })

  const cols = pixelated.width
  const rows = pixelated.height

  if (rows < 1 || cols < 1) {
    throw new Error('未能识别网格，请框选包含拼豆图案的区域')
  }

  const cells = cellsFromImageData(pixelated.data, cols, rows)
  if (cells.length === 0) {
    throw new Error('未能识别有效颜色，请重新框选')
  }

  return { rows, cols, cells, trimmed: useManual ? false : trimmed }
}
