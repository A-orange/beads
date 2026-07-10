import { MARD_PALETTE, type MardColor } from '../data/mard221'

interface LabColor {
  l: number
  a: number
  b: number
}

function rgbToLab(r: number, g: number, b: number): LabColor {
  let rr = r / 255
  let gg = g / 255
  let bb = b / 255

  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92

  const x = (rr * 0.4124 + gg * 0.3576 + bb * 0.1805) / 0.95047
  const y = rr * 0.2126 + gg * 0.7152 + bb * 0.0722
  const z = (rr * 0.0193 + gg * 0.1192 + bb * 0.9505) / 1.08883

  const fx = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116
  const fy = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116
  const fz = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

function deltaE(lab1: LabColor, lab2: LabColor): number {
  const dl = lab1.l - lab2.l
  const da = lab1.a - lab2.a
  const db = lab1.b - lab2.b
  return Math.sqrt(dl * dl + da * da + db * db)
}

const paletteLab = MARD_PALETTE.map((color) => ({
  color,
  lab: rgbToLab(color.rgb[0], color.rgb[1], color.rgb[2]),
}))

export function matchMardColor(r: number, g: number, b: number): MardColor {
  const inputLab = rgbToLab(r, g, b)
  let best = paletteLab[0]!
  let minDist = Infinity

  for (const entry of paletteLab) {
    const dist = deltaE(inputLab, entry.lab)
    if (dist < minDist) {
      minDist = dist
      best = entry
    }
  }

  return best.color
}

/** 多点采样后投票，取出现最多的 MARD 色 */
export function matchMardColorFromSamples(samples: Array<[number, number, number]>): MardColor {
  if (samples.length === 0) return MARD_PALETTE[0]!

  const votes = new Map<string, { color: MardColor; count: number }>()
  for (const [r, g, b] of samples) {
    const matched = matchMardColor(r, g, b)
    const entry = votes.get(matched.tag)
    if (entry) entry.count++
    else votes.set(matched.tag, { color: matched, count: 1 })
  }

  let best = [...votes.values()][0]!
  for (const entry of votes.values()) {
    if (entry.count > best.count) best = entry
  }
  return best.color
}

export function getContrastTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#333' : '#fff'
}
