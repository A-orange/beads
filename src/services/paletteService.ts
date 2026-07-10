import { ref, computed } from 'vue'
import { MARD_PALETTE } from '../data/mard221'
import {
  DEFAULT_PALETTE_ID,
  findPaletteMeta,
  getPaletteLabel,
  isPaletteAvailable,
} from '../data/paletteRegistry'
import type { BeadColor } from '../data/beadColor'

const STORAGE_KEY = 'beads.paletteId'

interface PaletteFile {
  id: string
  count: number
  colors: BeadColor[]
}

interface LabEntry {
  color: BeadColor
  lab: { l: number; a: number; b: number }
}

const activePaletteId = ref(loadStoredId())
const activeColors = ref<BeadColor[]>([...MARD_PALETTE])
const loading = ref(false)
let labCache: LabEntry[] = buildLabCache(activeColors.value)

const activeLabel = computed(() => getPaletteLabel(activePaletteId.value))

function loadStoredId() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_PALETTE_ID
  } catch {
    return DEFAULT_PALETTE_ID
  }
}

function saveStoredId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}

function rgbToLab(r: number, g: number, b: number) {
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
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }
}

function deltaE(
  a: { l: number; a: number; b: number },
  b: { l: number; a: number; b: number },
) {
  const dl = a.l - b.l
  const da = a.a - b.a
  const db = a.b - b.b
  return Math.sqrt(dl * dl + da * da + db * db)
}

function buildLabCache(colors: BeadColor[]): LabEntry[] {
  return colors.map((color) => ({
    color,
    lab: rgbToLab(color.rgb[0], color.rgb[1], color.rgb[2]),
  }))
}

async function fetchPaletteFile(file: string): Promise<BeadColor[]> {
  const res = await fetch(`/palettes/${file}`)
  if (!res.ok) throw new Error(`加载色卡失败: ${file}`)
  const json = (await res.json()) as PaletteFile
  return json.colors ?? []
}

export async function loadPalette(paletteId: string) {
  const meta = findPaletteMeta(paletteId)
  if (!meta || !isPaletteAvailable(meta.set)) {
    throw new Error('该色卡暂不可用')
  }

  loading.value = true
  try {
    const colors = await fetchPaletteFile(meta.set.file)
    if (!colors.length) throw new Error('色卡为空')
    activePaletteId.value = paletteId
    activeColors.value = colors
    labCache = buildLabCache(colors)
    saveStoredId(paletteId)
  } finally {
    loading.value = false
  }
}

export async function initPalette() {
  const id = activePaletteId.value
  if (id === DEFAULT_PALETTE_ID) {
    activeColors.value = [...MARD_PALETTE]
    labCache = buildLabCache(activeColors.value)
    return
  }
  try {
    await loadPalette(id)
  } catch {
    activePaletteId.value = DEFAULT_PALETTE_ID
    activeColors.value = [...MARD_PALETTE]
    labCache = buildLabCache(activeColors.value)
    saveStoredId(DEFAULT_PALETTE_ID)
  }
}

export function matchBeadColor(r: number, g: number, b: number): BeadColor {
  const inputLab = rgbToLab(r, g, b)
  let best = labCache[0]!
  let minDist = Infinity
  for (const entry of labCache) {
    const dist = deltaE(inputLab, entry.lab)
    if (dist < minDist) {
      minDist = dist
      best = entry
    }
  }
  return best.color
}

export function matchBeadColorFromSamples(
  samples: Array<[number, number, number]>,
): BeadColor {
  if (samples.length === 0) return activeColors.value[0] ?? MARD_PALETTE[0]!

  const votes = new Map<string, { color: BeadColor; count: number }>()
  for (const [r, g, b] of samples) {
    const matched = matchBeadColor(r, g, b)
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

export function usePaletteState() {
  return {
    activePaletteId,
    activeColors,
    activeLabel,
    loading,
    loadPalette,
  }
}
