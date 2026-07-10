import { computeBandPeriodicity } from './gridDetection'

export interface RegionRect {
  x: number
  y: number
  width: number
  height: number
}

/** 略微扩展框选区域，容忍不精确框选 */
export function expandRegion(
  region: RegionRect,
  imageWidth: number,
  imageHeight: number,
  ratio = 0.05,
): RegionRect {
  const padX = Math.round(region.width * ratio)
  const padY = Math.round(region.height * ratio)
  const x = Math.max(0, region.x - padX)
  const y = Math.max(0, region.y - padY)
  const width = Math.min(imageWidth - x, region.width + padX * 2)
  const height = Math.min(imageHeight - y, region.height + padY * 2)

  return { x, y, width, height }
}

/** 裁掉顶部标题、底部色卡等非网格区域 */
export function trimVerticalMargins(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): RegionRect {
  const bandHeight = Math.max(8, Math.floor(height / 80))
  const rowScores: number[] = []

  for (let y = 0; y < height; y += bandHeight) {
    const h = Math.min(bandHeight, height - y)
    rowScores.push(computeBandPeriodicity(data, width, height, 0, y, width, h, 'x'))
  }

  const maxScore = Math.max(...rowScores, 1)
  const threshold = maxScore * 0.28

  let topBand = 0
  for (let i = 0; i < rowScores.length; i++) {
    if (rowScores[i]! >= threshold) {
      topBand = i
      break
    }
  }

  let bottomBand = rowScores.length - 1
  for (let i = rowScores.length - 1; i >= 0; i--) {
    if (rowScores[i]! >= threshold) {
      bottomBand = i
      break
    }
  }

  const y = Math.max(0, topBand * bandHeight - Math.floor(bandHeight * 0.5))
  const bottom = Math.min(height, (bottomBand + 1) * bandHeight + bandHeight)
  const trimmedHeight = bottom - y

  return {
    x: 0,
    y,
    width,
    height: Math.max(trimmedHeight, Math.floor(height * 0.45)),
  }
}

/** 裁掉左右侧行列号标注区域 */
export function trimHorizontalMargins(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): RegionRect {
  const bandWidth = Math.max(8, Math.floor(width / 80))
  const colScores: number[] = []

  for (let x = 0; x < width; x += bandWidth) {
    const w = Math.min(bandWidth, width - x)
    colScores.push(computeBandPeriodicity(data, width, height, x, 0, w, height, 'y'))
  }

  const maxScore = Math.max(...colScores, 1)
  const threshold = maxScore * 0.28

  let leftBand = 0
  for (let i = 0; i < colScores.length; i++) {
    if (colScores[i]! >= threshold) {
      leftBand = i
      break
    }
  }

  let rightBand = colScores.length - 1
  for (let i = colScores.length - 1; i >= 0; i--) {
    if (colScores[i]! >= threshold) {
      rightBand = i
      break
    }
  }

  const x = Math.max(0, leftBand * bandWidth - Math.floor(bandWidth * 0.5))
  const right = Math.min(width, (rightBand + 1) * bandWidth + bandWidth)
  const trimmedWidth = right - x

  return {
    x,
    y: 0,
    width: Math.max(trimmedWidth, Math.floor(width * 0.45)),
    height,
  }
}

/**
 * 自动定位拼豆网格区域（去除标题、色卡、行列号边栏）
 * 返回相对于原图的坐标
 */
export function detectPatternBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): RegionRect {
  const vertical = trimVerticalMargins(data, width, height)
  const vCrop = cropImageData(data, width, vertical)
  const horizontal = trimHorizontalMargins(vCrop.data, vCrop.width, vCrop.height)

  return {
    x: vertical.x + horizontal.x,
    y: vertical.y + horizontal.y,
    width: horizontal.width,
    height: horizontal.height,
  }
}

export function cropImageData(
  data: Uint8ClampedArray,
  sourceWidth: number,
  region: RegionRect,
): ImageData {
  const { x, y, width, height } = region
  const cropped = new Uint8ClampedArray(width * height * 4)

  for (let row = 0; row < height; row++) {
    const srcStart = ((y + row) * sourceWidth + x) * 4
    const dstStart = row * width * 4
    cropped.set(data.subarray(srcStart, srcStart + width * 4), dstStart)
  }

  return new ImageData(cropped, width, height)
}
