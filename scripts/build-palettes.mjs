/**
 * 从 pindou-color-data 拉取色卡并生成 public/palettes/*.json
 * 运行: node scripts/build-palettes.mjs
 * 强制刷新: node scripts/build-palettes.mjs --force
 */
import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/palettes')
const FORCE = process.argv.includes('--force')

/** 多镜像：国内常无法直连 raw.githubusercontent.com */
const MIRRORS = [
  'https://cdn.jsdelivr.net/gh/HansBug/pindou-color-data@main',
  'https://raw.githubusercontent.com/HansBug/pindou-color-data/main',
]

const PATHS = {
  'mard-221': 'mard-221-github/colors.json',
  'mard-291': 'mard-291-github/colors.json',
  'coco-291': 'coco-291/colors.json',
  'manman-278': 'manman-278/colors.json',
  'mixiaowo-290': 'mixiaowo-290/colors.json',
  'panpan-289': 'panpan-289/colors.json',
}

const REQUIRED_FILES = [
  'manifest.json',
  ...Object.keys(PATHS).map((id) => `${id}.json`),
  'huangdoudou-291.json',
  'mard-24.json',
  'mard-48.json',
  'mard-72.json',
]

function normalizeColor(raw) {
  if (raw.unidentified || raw.code?.startsWith('UNKNOWN')) return null
  const rgb = raw.rgb
  if (!Array.isArray(rgb) || rgb.length < 3) return null
  const tag = String(raw.code ?? raw.tag ?? '').trim()
  if (!tag) return null
  let hex = String(raw.hex ?? '').trim()
  if (hex.length === 9) hex = hex.slice(0, 7)
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return null
  return {
    tag,
    hex: hex.toUpperCase(),
    rgb: [rgb[0], rgb[1], rgb[2]],
  }
}

function groupByPrefix(colors) {
  const groups = new Map()
  for (const c of colors) {
    const prefix = c.tag.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? 'OTHER'
    if (!groups.has(prefix)) groups.set(prefix, [])
    groups.get(prefix).push(c)
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true }))
  }
  return groups
}

/** 按色族均衡抽取，近似 MARD 入门套装覆盖 */
function pickKitSubset(colors, size) {
  const groups = groupByPrefix(colors)
  const weights = {
    A: 2.2,
    B: 1.8,
    C: 1.6,
    D: 1.2,
    E: 1.2,
    F: 1.4,
    G: 1.4,
    H: 1.8,
    M: 1.6,
    P: 0.6,
    R: 0.8,
    Q: 0.3,
    T: 0.2,
    Y: 0.3,
    ZG: 0.3,
  }
  const entries = [...groups.entries()].filter(([, list]) => list.length > 0)
  const totalWeight = entries.reduce((s, [k]) => s + (weights[k] ?? 1), 0)
  const picked = []

  for (const [prefix, list] of entries) {
    const w = weights[prefix] ?? 1
    let count = Math.min(list.length, Math.max(1, Math.round((size * w) / totalWeight)))
    if (picked.length + count > size) count = size - picked.length
    if (count <= 0) continue
    const step = list.length / count
    for (let i = 0; i < count; i++) {
      picked.push(list[Math.min(list.length - 1, Math.floor(i * step + step / 2))])
    }
  }

  if (picked.length < size) {
    const used = new Set(picked.map((c) => c.tag))
    for (const c of colors) {
      if (picked.length >= size) break
      if (!used.has(c.tag)) picked.push(c)
    }
  }

  return picked.slice(0, size).sort((a, b) =>
    a.tag.localeCompare(b.tag, undefined, { numeric: true }),
  )
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchJson(url, retries = 2) {
  let lastErr
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      lastErr = err
      if (i < retries) await sleep(500 * (i + 1))
    }
  }
  throw lastErr
}

async function fetchPalette(relPath) {
  let lastErr
  for (const base of MIRRORS) {
    const url = `${base}/${relPath}`
    try {
      const json = await fetchJson(url)
      const colors = (json.colors ?? [])
        .map(normalizeColor)
        .filter(Boolean)
      return colors
    } catch (err) {
      lastErr = err
      console.warn(`  ⚠ ${url} → ${err.cause?.code ?? err.message}`)
    }
  }
  throw lastErr
}

async function writePalette(id, colors, meta = {}) {
  const payload = { id, count: colors.length, ...meta, colors }
  await writeFile(join(OUT_DIR, `${id}.json`), JSON.stringify(payload), 'utf8')
  console.log(`  ${id}.json (${colors.length} colors)`)
}

async function localPalettesReady() {
  try {
    await Promise.all(REQUIRED_FILES.map((f) => access(join(OUT_DIR, f))))
    return true
  } catch {
    return false
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  if (!FORCE && (await localPalettesReady())) {
    console.log('Building palettes... skipped (local files present, use --force to refresh)')
    return
  }

  console.log('Building palettes...')

  try {
    const loaded = {}
    for (const [id, relPath] of Object.entries(PATHS)) {
      loaded[id] = await fetchPalette(relPath)
      await writePalette(id, loaded[id])
    }

    // 黄豆豆公开数据与 MARD 291 一致
    await writePalette('huangdoudou-291', loaded['mard-291'], {
      aliasOf: 'mard-291',
      note: '公开色卡数据与 MARD 291 一致',
    })

    const mard221 = loaded['mard-221']
    for (const size of [24, 48, 72]) {
      const subset = pickKitSubset(mard221, size)
      await writePalette(`mard-${size}`, subset, {
        subsetOf: 'mard-221',
        kitSize: size,
      })
    }

    const manifest = {
      generatedAt: new Date().toISOString(),
      palettes: [
        { id: 'mard-24', brand: 'mard', label: '24色套装', file: 'mard-24.json' },
        { id: 'mard-48', brand: 'mard', label: '48色套装', file: 'mard-48.json' },
        { id: 'mard-72', brand: 'mard', label: '72色套装', file: 'mard-72.json' },
        { id: 'mard-221', brand: 'mard', label: '221色', file: 'mard-221.json' },
        { id: 'mard-291', brand: 'mard', label: '291全色', file: 'mard-291.json' },
        { id: 'coco-291', brand: 'coco', label: '291色', file: 'coco-291.json' },
        { id: 'huangdoudou-291', brand: 'huangdoudou', label: '291色', file: 'huangdoudou-291.json' },
        { id: 'manman-278', brand: 'manman', label: '278色', file: 'manman-278.json' },
        { id: 'mixiaowo-290', brand: 'mixiaowo', label: '290色', file: 'mixiaowo-290.json' },
        { id: 'panpan-289', brand: 'panpan', label: '289色', file: 'panpan-289.json' },
      ],
    }
    await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
    console.log('Done.')
  } catch (err) {
    if (await localPalettesReady()) {
      console.warn(`Network fetch failed (${err.cause?.code ?? err.message}), using existing public/palettes/`)
      return
    }
    throw err
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
