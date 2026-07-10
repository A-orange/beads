/**
 * 从 pindou-color-data 拉取色卡并生成 public/palettes/*.json
 * 运行: node scripts/build-palettes.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/palettes')
const BASE = 'https://raw.githubusercontent.com/HansBug/pindou-color-data/main'

const SOURCES = {
  'mard-221': `${BASE}/mard-221-github/colors.json`,
  'mard-291': `${BASE}/mard-291-github/colors.json`,
  'coco-291': `${BASE}/coco-291/colors.json`,
  'manman-278': `${BASE}/manman-278/colors.json`,
  'mixiaowo-290': `${BASE}/mixiaowo-290/colors.json`,
  'panpan-289': `${BASE}/panpan-289/colors.json`,
}

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
  let remaining = size

  for (const [prefix, list] of entries) {
    const w = weights[prefix] ?? 1
    let count = Math.min(list.length, Math.max(1, Math.round((size * w) / totalWeight)))
    if (picked.length + count > size) count = size - picked.length
    if (count <= 0) continue
    const step = list.length / count
    for (let i = 0; i < count; i++) {
      picked.push(list[Math.min(list.length - 1, Math.floor(i * step + step / 2))])
    }
    remaining -= count
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

async function fetchPalette(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed ${url}: ${res.status}`)
  const json = await res.json()
  const colors = (json.colors ?? [])
    .map(normalizeColor)
    .filter(Boolean)
  return colors
}

async function writePalette(id, colors, meta = {}) {
  const payload = { id, count: colors.length, ...meta, colors }
  await writeFile(join(OUT_DIR, `${id}.json`), JSON.stringify(payload), 'utf8')
  console.log(`  ${id}.json (${colors.length} colors)`)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  console.log('Building palettes...')

  const loaded = {}
  for (const [id, url] of Object.entries(SOURCES)) {
    loaded[id] = await fetchPalette(url)
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
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
