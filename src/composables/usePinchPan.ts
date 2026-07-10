import { ref, computed, nextTick, watch, type Ref } from 'vue'

interface PinchPanOptions {
  minScale?: number
  maxScale?: number
  contentSize?: Ref<{ w: number; h: number } | null>
}

function touchDistance(touches: TouchList) {
  const a = touches[0]!
  const b = touches[1]!
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

export function usePinchPan(
  containerRef: Ref<HTMLElement | null>,
  contentRef: Ref<HTMLElement | null>,
  options: PinchPanOptions = {},
) {
  const minScale = options.minScale ?? 0.15
  const maxScale = options.maxScale ?? 12

  const scale = ref(1)
  const translateX = ref(0)
  const translateY = ref(0)

  const transformStyle = computed(() => ({
    transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
    transformOrigin: '0 0',
    willChange: 'transform',
  }))

  let isPanning = false
  let lastX = 0
  let lastY = 0
  let pinchStartDist = 0
  let pinchStartScale = 1
  let pinchAnchorX = 0
  let pinchAnchorY = 0

  function getBounds() {
    const container = containerRef.value
    if (!container) return null

    const measured = options.contentSize?.value
    const contentW = measured?.w ?? contentRef.value?.offsetWidth ?? 0
    const contentH = measured?.h ?? contentRef.value?.offsetHeight ?? 0

    return {
      cw: container.clientWidth,
      ch: container.clientHeight,
      contentW,
      contentH,
    }
  }

  function fitToView(padding = 12) {
    const bounds = getBounds()
    if (!bounds || bounds.contentW <= 0 || bounds.contentH <= 0) return

    const sx = (bounds.cw - padding * 2) / bounds.contentW
    const sy = (bounds.ch - padding * 2) / bounds.contentH
    const nextScale = Math.min(sx, sy)

    scale.value = nextScale
    translateX.value = (bounds.cw - bounds.contentW * nextScale) / 2
    translateY.value = (bounds.ch - bounds.contentH * nextScale) / 2
  }

  function clampScale(value: number) {
    return Math.min(maxScale, Math.max(minScale, value))
  }

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const container = containerRef.value
    if (!container || factor === 1) return

    const rect = container.getBoundingClientRect()
    const anchorX = clientX - rect.left
    const anchorY = clientY - rect.top
    const nextScale = clampScale(scale.value * factor)
    const ratio = nextScale / scale.value

    translateX.value = anchorX - ratio * (anchorX - translateX.value)
    translateY.value = anchorY - ratio * (anchorY - translateY.value)
    scale.value = nextScale
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault()
    const factor = Math.exp(-event.deltaY * 0.002)
    zoomAt(event.clientX, event.clientY, factor)
  }

  function onMouseDown(event: MouseEvent) {
    if (event.button !== 0) return
    isPanning = true
    lastX = event.clientX
    lastY = event.clientY
    event.preventDefault()
  }

  function onMouseMove(event: MouseEvent) {
    if (!isPanning) return
    translateX.value += event.clientX - lastX
    translateY.value += event.clientY - lastY
    lastX = event.clientX
    lastY = event.clientY
  }

  function onMouseUp() {
    isPanning = false
  }

  function onTouchStart(event: TouchEvent) {
    if (event.touches.length === 1) {
      isPanning = true
      lastX = event.touches[0]!.clientX
      lastY = event.touches[0]!.clientY
    } else if (event.touches.length === 2) {
      isPanning = false
      pinchStartDist = touchDistance(event.touches)
      pinchStartScale = scale.value

      const container = containerRef.value
      if (container) {
        const rect = container.getBoundingClientRect()
        pinchAnchorX = (event.touches[0]!.clientX + event.touches[1]!.clientX) / 2 - rect.left
        pinchAnchorY = (event.touches[0]!.clientY + event.touches[1]!.clientY) / 2 - rect.top
      }
    }
  }

  function onTouchMove(event: TouchEvent) {
    if (event.touches.length === 1 && isPanning) {
      event.preventDefault()
      const touch = event.touches[0]!
      translateX.value += touch.clientX - lastX
      translateY.value += touch.clientY - lastY
      lastX = touch.clientX
      lastY = touch.clientY
      return
    }

    if (event.touches.length === 2 && pinchStartDist > 0) {
      event.preventDefault()
      const dist = touchDistance(event.touches)
      const nextScale = clampScale(pinchStartScale * (dist / pinchStartDist))
      const ratio = nextScale / scale.value

      translateX.value = pinchAnchorX - ratio * (pinchAnchorX - translateX.value)
      translateY.value = pinchAnchorY - ratio * (pinchAnchorY - translateY.value)
      scale.value = nextScale
    }
  }

  function onTouchEnd(event: TouchEvent) {
    if (event.touches.length === 0) {
      isPanning = false
      pinchStartDist = 0
      return
    }

    if (event.touches.length === 1) {
      isPanning = true
      lastX = event.touches[0]!.clientX
      lastY = event.touches[0]!.clientY
      pinchStartDist = 0
    }
  }

  function bindFitWhenReady(getSignal: () => unknown) {
    watch(getSignal, async () => {
      await nextTick()
      requestAnimationFrame(() => fitToView())
    })
  }

  return {
    scale,
    translateX,
    translateY,
    transformStyle,
    fitToView,
    resetView: () => fitToView(),
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onWheel,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    bindFitWhenReady,
  }
}
