export interface PaletteSetOption {
  id: string
  label: string
  file: string
}

export interface PaletteBrand {
  id: string
  name: string
  sets: PaletteSetOption[]
}

/** 厂家与套装配置（色卡数据见 public/palettes/） */
export const PALETTE_BRANDS: PaletteBrand[] = [
  {
    id: 'mard',
    name: 'MARD',
    sets: [
      { id: 'mard-24', label: '24色套装', file: 'mard-24.json' },
      { id: 'mard-48', label: '48色套装', file: 'mard-48.json' },
      { id: 'mard-72', label: '72色套装', file: 'mard-72.json' },
      { id: 'mard-221', label: '221色', file: 'mard-221.json' },
      { id: 'mard-291', label: '291全色', file: 'mard-291.json' },
    ],
  },
  {
    id: 'coco',
    name: 'COCO',
    sets: [{ id: 'coco-291', label: '291色', file: 'coco-291.json' }],
  },
  {
    id: 'huangdoudou',
    name: '黄豆豆',
    sets: [{ id: 'huangdoudou-291', label: '291色', file: 'huangdoudou-291.json' }],
  },
  {
    id: 'manman',
    name: '漫漫',
    sets: [{ id: 'manman-278', label: '278色', file: 'manman-278.json' }],
  },
  {
    id: 'mixiaowo',
    name: '咪小窝',
    sets: [{ id: 'mixiaowo-290', label: '290色', file: 'mixiaowo-290.json' }],
  },
  {
    id: 'panpan',
    name: '盼盼',
    sets: [{ id: 'panpan-289', label: '289色', file: 'panpan-289.json' }],
  },
  {
    id: 'kaka',
    name: '卡卡',
    sets: [{ id: 'kaka-soon', label: '284色（即将支持）', file: '' }],
  },
]

export const DEFAULT_PALETTE_ID = 'mard-221'

const setById = new Map<string, { brand: PaletteBrand; set: PaletteSetOption }>()
for (const brand of PALETTE_BRANDS) {
  for (const set of brand.sets) {
    setById.set(set.id, { brand, set })
  }
}

export function findPaletteMeta(paletteId: string) {
  return setById.get(paletteId)
}

export function getPaletteLabel(paletteId: string) {
  const meta = findPaletteMeta(paletteId)
  if (!meta) return paletteId
  return `${meta.brand.name} · ${meta.set.label}`
}

export function isPaletteAvailable(set: PaletteSetOption) {
  return Boolean(set.file)
}
