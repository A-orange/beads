export interface GridSize {
  rows: number
  cols: number
}

function colorDiff(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}

function computeEdgeProfile(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  axis: 'x' | 'y',
): Float32Array {
  if (axis === 'x') {
    const profile = new Float32Array(width - 1)
    for (let x = 0; x < width - 1; x++) {
      let sum = 0
      for (let y = 0; y < height; y++) {
        const i1 = (y * width + x) * 4
        const i2 = (y * width + x + 1) * 4
        sum += colorDiff(data[i1], data[i1 + 1], data[i1 + 2], data[i2], data[i2 + 1], data[i2 + 2])
      }
      profile[x] = sum / height
    }
    return profile
  }

  const profile = new Float32Array(height - 1)
  for (let y = 0; y < height - 1; y++) {
    let sum = 0
    for (let x = 0; x < width; x++) {
      const i1 = (y * width + x) * 4
      const i2 = ((y + 1) * width + x) * 4
      sum += colorDiff(data[i1], data[i1 + 1], data[i1 + 2], data[i2], data[i2 + 1], data[i2 + 2])
    }
    profile[y] = sum / width
  }
  return profile
}

function smoothProfile(profile: Float32Array, radius: number): Float32Array {
  const result = new Float32Array(profile.length)
  for (let i = 0; i < profile.length; i++) {
    let sum = 0
    let count = 0
    for (let d = -radius; d <= radius; d++) {
      const idx = i + d
      if (idx >= 0 && idx < profile.length) {
        sum += profile[idx]!
        count++
      }
    }
    result[i] = sum / count
  }
  return result
}

function periodCorrelation(profile: Float32Array, period: number): number {
  if (period < 2 || period >= profile.length) return 0
  let score = 0
  let count = 0
  for (let i = 0; i < profile.length - period; i++) {
    score += profile[i]! * profile[i + period]!
    count++
  }
  return count > 0 ? score / count : 0
}

function scoreGridAlignment(profile: Float32Array, cellSize: number): number {
  let score = 0
  const lineCount = Math.floor(profile.length / cellSize) + 1
  for (let i = 0; i < lineCount; i++) {
    const pos = Math.round(i * cellSize)
    for (let d = -2; d <= 2; d++) {
      const p = pos + d
      if (p >= 0 && p < profile.length) score += profile[p]! * (3 - Math.abs(d))
    }
  }
  return score
}

function cellStepRange(dimension: number) {
  return {
    min: Math.max(3, Math.floor(dimension / 120)),
    max: Math.min(36, Math.floor(dimension / 5)),
  }
}

/** 根据区域尺寸自适应格宽（24×24 ~ 80×80 常见规格） */
function findBeadCellStep(profile: Float32Array, dimension: number): number {
  const { min: minStep, max: maxStep } = cellStepRange(dimension)
  const fallback = Math.max(minStep, Math.round(dimension / 50))

  let bestStep = fallback
  let bestScore = -Infinity

  for (let step = minStep; step <= maxStep; step++) {
    const score = periodCorrelation(profile, step)
    if (score > bestScore) {
      bestScore = score
      bestStep = step
    }
  }

  return bestStep
}

function refineCellCount(profile: Float32Array, dimension: number, step: number): number {
  const estimate = Math.max(1, Math.round(dimension / step))
  let bestCount = estimate
  let bestScore = -Infinity

  for (const candidate of [estimate - 3, estimate - 2, estimate - 1, estimate, estimate + 1, estimate + 2, estimate + 3]) {
    if (candidate < 1) continue
    const score = scoreGridAlignment(profile, dimension / candidate)
    if (score > bestScore) {
      bestScore = score
      bestCount = candidate
    }
  }

  return bestCount
}

/** 在拼豆图纸常见格宽范围内估算网格 */
export function estimateBeadGridSize(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): GridSize {
  const colProfile = smoothProfile(computeEdgeProfile(data, width, height, 'x'), 2)
  const rowProfile = smoothProfile(computeEdgeProfile(data, width, height, 'y'), 2)

  const colStep = findBeadCellStep(colProfile, width)
  const rowStep = findBeadCellStep(rowProfile, height)
  const step = Math.round((colStep + rowStep) / 2)

  return {
    cols: refineCellCount(colProfile, width, step),
    rows: refineCellCount(rowProfile, height, step),
  }
}

export function isPlausibleBeadGrid(width: number, height: number, cols: number, rows: number): boolean {
  if (cols < 4 || rows < 4 || cols > 120 || rows > 120) return false
  const cellW = width / cols
  const cellH = height / rows
  const { min, max } = cellStepRange(Math.min(width, height))
  return cellW >= min && cellW <= max && cellH >= min && cellH <= max
}

/** 接近正方形网格时取整（如 49×49、50×50） */
export function refineSquareGrid(
  width: number,
  height: number,
  cols: number,
  rows: number,
): { cols: number; rows: number } {
  const aspect = width / height
  const countDiff = Math.abs(cols - rows)
  const isSquareish = aspect > 0.82 && aspect < 1.22

  if (isSquareish && countDiff <= 3) {
    const n = Math.round((cols + rows) / 2)
    return { cols: n, rows: n }
  }

  return { cols, rows }
}

/** 计算区域内网格周期性强度，用于裁剪标题/色卡 */
export function computeBandPeriodicity(
  data: Uint8ClampedArray,
  width: number,
  _height: number,
  offsetX: number,
  offsetY: number,
  regionWidth: number,
  regionHeight: number,
  axis: 'x' | 'y',
): number {
  if (regionWidth < 8 || regionHeight < 8) return 0

  let subProfile: Float32Array
  if (axis === 'x') {
    subProfile = new Float32Array(regionWidth - 1)
    for (let x = 0; x < regionWidth - 1; x++) {
      let sum = 0
      for (let y = 0; y < regionHeight; y++) {
        const i1 = ((offsetY + y) * width + offsetX + x) * 4
        const i2 = i1 + 4
        sum += colorDiff(data[i1], data[i1 + 1], data[i1 + 2], data[i2], data[i2 + 1], data[i2 + 2])
      }
      subProfile[x] = sum / regionHeight
    }
  } else {
    subProfile = new Float32Array(regionHeight - 1)
    for (let y = 0; y < regionHeight - 1; y++) {
      let sum = 0
      for (let x = 0; x < regionWidth; x++) {
        const i1 = ((offsetY + y) * width + offsetX + x) * 4
        const i2 = ((offsetY + y + 1) * width + offsetX + x) * 4
        sum += colorDiff(data[i1], data[i1 + 1], data[i1 + 2], data[i2], data[i2 + 1], data[i2 + 2])
      }
      subProfile[y] = sum / regionWidth
    }
  }

  const smoothed = smoothProfile(subProfile, 2)
  const dimension = axis === 'x' ? regionWidth : regionHeight
  const { min, max } = cellStepRange(dimension)
  let best = 0
  for (let period = min; period <= Math.min(max, Math.floor(dimension / 3)); period++) {
    const score = periodCorrelation(smoothed, period)
    if (score > best) best = score
  }
  return best
}

/** 区域网格信号强度，用于自动检测置信度 */
export function measureGridStrength(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  const xScore = computeBandPeriodicity(data, width, height, 0, 0, width, height, 'x')
  const yScore = computeBandPeriodicity(data, width, height, 0, 0, width, height, 'y')
  return (xScore + yScore) / 2
}
