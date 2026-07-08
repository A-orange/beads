import type { MardColor } from './data/mard221'
import type { BeadCell } from './utils/imageAnalysis'

export interface ColorUsage {
  color: MardColor
  count: number
  visible: boolean
}

export interface GridState {
  rows: number
  cols: number
  cells: BeadCell[]
}
