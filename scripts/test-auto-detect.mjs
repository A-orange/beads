import sharp from 'sharp'
import { detectPatternBounds, cropImageData } from '../src/utils/regionTrim.ts'
import {
  estimateBeadGridSize,
  isPlausibleBeadGrid,
  measureGridStrength,
  refineSquareGrid,
} from '../src/utils/gridDetection.ts'
import { snap } from 'fast-pixelizer'

const imgPath = process.argv[2]
if (!imgPath) {
  console.error('Usage: node scripts/test-auto-detect.mjs <image>')
  process.exit(1)
}

const { data, info } = await sharp(imgPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const full = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)

const bounds = detectPatternBounds(full, info.width, info.height)
const pattern = cropImageData(full, info.width, bounds)
const strength = measureGridStrength(pattern.data, pattern.width, pattern.height)

const estimated = estimateBeadGridSize(pattern.data, pattern.width, pattern.height)
const refined = refineSquareGrid(pattern.width, pattern.height, estimated.cols, estimated.rows)
const snapped = snap(pattern, { colorVariety: 80, output: 'resized' })

const snapOk = isPlausibleBeadGrid(pattern.width, pattern.height, snapped.width, snapped.height)
const estOk = isPlausibleBeadGrid(pattern.width, pattern.height, refined.cols, refined.rows)

console.log('image', info.width, 'x', info.height)
console.log('bounds', bounds)
console.log('pattern', pattern.width, 'x', pattern.height)
console.log('strength', strength.toFixed(1))
console.log('snap', `${snapped.width}x${snapped.height}`, snapOk ? 'ok' : 'bad')
console.log('estimate', `${refined.cols}x${refined.rows}`, estOk ? 'ok' : 'bad')
console.log('cell', (pattern.width / refined.cols).toFixed(1), 'px')
