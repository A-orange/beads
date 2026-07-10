const OVERLAY_IDS = ['ax-comment-root', 'prototypeOverlay'] as const

function removeById(id: string): boolean {
  const el = document.getElementById(id)
  if (!el) return false
  el.remove()
  return true
}

/** 清除托管平台注入的遮罩/评论节点；首次未找到则 500ms 后再试一次 */
export function removeHostOverlays() {
  const pending = new Set<string>(OVERLAY_IDS)

  for (const id of OVERLAY_IDS) {
    if (removeById(id)) pending.delete(id)
  }

  if (pending.size === 0) return

  window.setTimeout(() => {
    for (const id of pending) removeById(id)
  }, 500)
}
