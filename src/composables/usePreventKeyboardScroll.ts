import { onMounted, onUnmounted } from 'vue'

function isTextInput(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false
  if (el instanceof HTMLInputElement) {
    const type = el.type.toLowerCase()
    if (type === 'checkbox' || type === 'radio' || type === 'file' || type === 'button') return false
    return true
  }
  return el instanceof HTMLTextAreaElement || el.isContentEditable
}

function resetDocumentScroll() {
  window.scrollTo(0, 0)
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

function updateVisualViewportVars() {
  const vv = window.visualViewport
  const root = document.documentElement
  if (!vv) {
    root.style.setProperty('--vv-top', '0px')
    root.style.setProperty('--vv-left', '0px')
    root.style.setProperty('--vv-width', '100vw')
    root.style.setProperty('--vv-height', '100dvh')
    return
  }

  root.style.setProperty('--vv-top', `${vv.offsetTop}px`)
  root.style.setProperty('--vv-left', `${vv.offsetLeft}px`)
  root.style.setProperty('--vv-width', `${vv.width}px`)
  root.style.setProperty('--vv-height', `${vv.height}px`)
  resetDocumentScroll()
}

const scrollIntoViewStore = new WeakMap<HTMLElement, Element['scrollIntoView']>()

function blockScrollIntoView(el: HTMLElement) {
  if (scrollIntoViewStore.has(el)) return
  scrollIntoViewStore.set(el, el.scrollIntoView.bind(el))
  el.scrollIntoView = () => {}
}

function restoreScrollIntoView(el: HTMLElement) {
  const original = scrollIntoViewStore.get(el)
  if (original) {
    el.scrollIntoView = original
    scrollIntoViewStore.delete(el)
  }
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** iOS Safari：防止输入法顶起页面（visualViewport + 禁止 scrollIntoView + 锁定滚动） */
export function usePreventKeyboardScroll() {
  let focusResetTimer = 0
  let rafId = 0

  function scheduleScrollReset() {
    cancelAnimationFrame(rafId)
    let frames = 0
    const tick = () => {
      resetDocumentScroll()
      updateVisualViewportVars()
      if (++frames < 8) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  function onViewportChange() {
    updateVisualViewportVars()
    if (isTextInput(document.activeElement)) scheduleScrollReset()
  }

  function onFocusIn(event: FocusEvent) {
    if (!isTextInput(event.target)) return
    const el = event.target as HTMLElement
    blockScrollIntoView(el)
    document.documentElement.classList.add('input-focused')
    updateVisualViewportVars()
    scheduleScrollReset()
    focusResetTimer = window.setTimeout(scheduleScrollReset, 120)
  }

  function onFocusOut(event: FocusEvent) {
    const target = event.target
    if (target instanceof HTMLElement) restoreScrollIntoView(target)

    window.setTimeout(() => {
      if (isTextInput(document.activeElement)) return
      document.documentElement.classList.remove('input-focused')
      updateVisualViewportVars()
      scheduleScrollReset()
    }, 80)
  }

  onMounted(() => {
    if (isIosDevice()) {
      document.documentElement.classList.add('ios-touch')
    }
    updateVisualViewportVars()

    const vv = window.visualViewport
    vv?.addEventListener('resize', onViewportChange)
    vv?.addEventListener('scroll', onViewportChange)
    window.addEventListener('resize', onViewportChange)
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('focusout', onFocusOut, true)
  })

  onUnmounted(() => {
    const vv = window.visualViewport
    vv?.removeEventListener('resize', onViewportChange)
    vv?.removeEventListener('scroll', onViewportChange)
    window.removeEventListener('resize', onViewportChange)
    document.removeEventListener('focusin', onFocusIn, true)
    document.removeEventListener('focusout', onFocusOut, true)
    if (focusResetTimer) window.clearTimeout(focusResetTimer)
    if (rafId) cancelAnimationFrame(rafId)
    document.documentElement.classList.remove('input-focused', 'ios-touch')
  })
}
