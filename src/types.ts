import type { BeadColor } from './data/beadColor'
import type { BeadCell } from './utils/imageAnalysis'

export type { BeadColor }

export interface ColorUsage {
  color: BeadColor
  count: number
  visible: boolean
  isBackground?: boolean
}

export interface GridState {
  rows: number
  cols: number
  cells: BeadCell[]
}
