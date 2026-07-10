/** 该色号是否参与拼豆计数 */
export function countsAsBead(
  tag: string,
  hiddenColors: Set<string>,
  backgroundColors: Set<string>,
): boolean {
  return !hiddenColors.has(tag) && !backgroundColors.has(tag)
}

/** 网格绘制：背景色视为空位 */
export function isBackgroundCell(tag: string, backgroundColors: Set<string>): boolean {
  return backgroundColors.has(tag)
}

export function mergeBackgroundColors(
  prev: Set<string>,
  beadCells: { color: { tag: string } }[],
): Set<string> {
  const valid = new Set(beadCells.map((c) => c.color.tag))
  const next = new Set<string>()
  for (const tag of prev) {
    if (valid.has(tag)) next.add(tag)
  }
  return next
}
