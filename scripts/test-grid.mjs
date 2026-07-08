import sharp from 'sharp'
import { snap } from 'fast-pixelizer'
import { estimateBeadGridSize, isPlausibleBeadGrid } from '../src/utils/gridDetection.ts'

const imgPath = process.argv[2]
const { data, info } = await sharp(imgPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const full = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)

function crop(x, y, w, h) {
  const out = new Uint8ClampedArray(w * h * 4)
  for (let row = 0; row < h; row++) {
    out.set(full.subarray(((y + row) * info.width + x) * 4, ((y + row) * info.width + x + w) * 4), row * w * 4)
  }
  return { data: out, width: w, height: h }
}

function test(name, region) {
  const s = snap(region, { colorVariety: 80, output: 'resized' })
  const e = estimateBeadGridSize(region.data, region.width, region.height)
  const snapOk = isPlausibleBeadGrid(region.width, region.height, s.width, s.height)
  const estOk = isPlausibleBeadGrid(region.width, region.height, e.cols, e.rows)
  const pick = snapOk ? { cols: s.width, rows: s.height } : estOk ? e : e
  console.log(name, `snap ${s.width}x${s.height}(${snapOk ? 'ok' : 'bad'})`, `est ${e.cols}x${e.rows}(${estOk ? 'ok' : 'bad'})`, '->', `${pick.cols}x${pick.rows}`)
}

test('pattern', crop(90, 165, 640, 830))
test('loose', crop(10, 60, 765, 900))
test('small256', crop(90, 165, 256, 256))
test('bad32sim', crop(10, 60, 765, 900)) // snap should be ~94

// simulate under-detect: artificially what if snap returned 32 on 765 width
console.log('plausible 32 on 765?', isPlausibleBeadGrid(765, 900, 32, 32))
