export interface BeadColor {
  tag: string
  hex: string
  rgb: [number, number, number]
}

/** @deprecated 使用 BeadColor */
export type MardColor = BeadColor
