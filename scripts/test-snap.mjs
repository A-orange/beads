import sharp from 'sharp'
import { snap } from 'fast-pixelizer'

// Inline trim logic for testing
function colorDiff(r1, g1, b1, r2, g2, b2) {
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}

function computeBandPeriodicity(data, width, height, offsetX, offsetY, regionWidth, regionHeight, axis) {
  const profile = new Float32Array(axis === 'x' ? regionWidth - 1 : regionHeight - 1)
  if (axis === 'x') {
    for (let x = 0; x < regionWidth - 1; x++) {
      let sum = 0
      for (let y = 0; y < regionHeight; y++) {
        const i1 = ((offsetY + y) * width + offsetX + x) * 4
        const i2 = i1 + 4
        sum += colorDiff(data[i1], data[i1 + 1], data[i1 + 2], data[i2], data[i2 + 1], data[i2 + 2])
      }
      profile[x] = sum / regionHeight
    }
  } else {
    for (let y = 0; y < regionHeight - 1; y++) {
      let sum = 0
      for (let x = 0; x < regionWidth; x++) {
        const i1 = ((offsetY + y) * width + offsetX + x) * 4
        const i2 = ((offsetY + y + 1) * width + offsetX + x) * 4
        sum += colorDiff(data[i1], data[i1 + 1], data[i1 + 2], data[i2], data[i2 + 1], data[i2 + 2])
      }
      profile[y] = sum / regionWidth
    }
  }
  const dimension = axis === 'x' ? regionWidth : regionHeight
  const minPeriod = Math.max(4, Math.floor(dimension / 200))
  const maxPeriod = Math.floor(dimension / 3)
  let best = 0
  for (let period = minPeriod; period <= maxPeriod; period++) {
    let score = 0, count = 0
    for (let i = 0; i < profile.length - period; i++) {
      score += profile[i] * profile[i + period]
      count++
    }
    if (count) score /= count
    if (score > best) best = score
  }
  return best
}

function trimVerticalMargins(data, width, height) {
  const bandHeight = Math.max(12, Math.floor(height / 60))
  const rowScores = []
  for (let y = 0; y < height; y += bandHeight) {
    const h = Math.min(bandHeight, height - y)
    rowScores.push(computeBandPeriodicity(data, width, height, 0, y, width, h, 'x'))
  }
  const maxScore = Math.max(...rowScores, 1)
  const threshold = maxScore * 0.3
  let topBand = 0
  for (let i = 0; i < rowScores.length; i++) if (rowScores[i] >= threshold) { topBand = i; break }
  let bottomBand = rowScores.length - 1
  for (let i = rowScores.length - 1; i >= 0; i--) if (rowScores[i] >= threshold) { bottomBand = i; break }
  const y = Math.max(0, topBand * bandHeight - bandHeight)
  const bottom = Math.min(height, (bottomBand + 2) * bandHeight)
  return { x: 0, y, width, height: bottom - y }
}

function crop(data, sw, region) {
  const { x, y, width, height } = region
  const out = new Uint8ClampedArray(width * height * 4)
  for (let row = 0; row < height; row++) {
    out.set(data.subarray(((y + row) * sw + x) * 4, ((y + row) * sw + x + width) * 4), row * width * 4)
  }
  return { data: out, width, height }
}

const imgPath = process.argv[2]
const { data, info } = await sharp(imgPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const full = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)

function getRegion(x, y, w, h) {
  const out = new Uint8ClampedArray(w * h * 4)
  for (let row = 0; row < h; row++) out.set(full.subarray(((y + row) * info.width + x) * 4, ((y + row) * info.width + x + w) * 4), row * w * 4)
  return { data: out, width: w, height: h }
}

const loose = getRegion(10, 60, 765, 900)
const trimmed = trimVerticalMargins(loose.data, loose.width, loose.height)
console.log('trimmed', trimmed)
const pattern = crop(loose.data, loose.width, trimmed)
const r = snap(pattern, { colorVariety: 80, output: 'resized' })
console.log('pipeline', r.width, 'x', r.height)

const r2 = snap(loose, { colorVariety: 80, output: 'resized' })
console.log('no trim', r2.width, 'x', r2.height)
