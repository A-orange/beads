<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { BeadCell } from '../utils/imageAnalysis'
import type { BeadColor } from '../data/beadColor'
import { usePinchPan } from '../composables/usePinchPan'
import { usePaletteState } from '../services/paletteService'
import ColorPickDialog from './ColorPickDialog.vue'
import SdIcon from './SdIcon.vue'
import { drawBeadGrid, getBeadGridWorldSize, hitTestBeadCell } from '../utils/beadGridCanvas'

const props = defineProps<{
  rows: number
  cols: number
  cells: BeadCell[]
  hiddenColors: Set<string>
  backgroundColors: Set<string>
  cellSize?: number
}>()

const emit = defineEmits<{
  replaceCells: [keys: Array<{ row: number; col: number }>, color: BeadColor]
}>()

const { activeColors } = usePaletteState()

const CELL_SIZE = computed(() => props.cellSize ?? 20)

const containerRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)

const selectedKeys = ref<Set<string>>(new Set())
const pickerOpen = ref(false)

const TAP_THRESHOLD_PX = 10

const worldSize = computed(() => {
  if (props.rows <= 0 || props.cols <= 0) return null
  const { width, height } = getBeadGridWorldSize(props.rows, props.cols, CELL_SIZE.value)
  return { w: width, h: height }
})

const selectedCount = computed(() => selectedKeys.value.size)

const cellMap = computed(() => {
  const map = new Map<string, BeadCell>()
  for (const cell of props.cells) {
    map.set(`${cell.row}-${cell.col}`, cell)
  }
  return map
})

const pickerCurrentColor = computed(() => {
  const firstKey = selectedKeys.value.values().next().value
  if (!firstKey) return null
  return cellMap.value.get(firstKey)?.color ?? null
})

const {
  scale,
  translateX,
  translateY,
  fitToView,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onWheel,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  bindFitWhenReady,
} = usePinchPan(containerRef, contentRef, { contentSize: worldSize })

bindFitWhenReady(() => [props.rows, props.cols, CELL_SIZE.value])

let drawRaf = 0
let resizeObserver: ResizeObserver | null = null
let tapStart: { x: number; y: number } | null = null
let lastTouchSelectAt = 0

function scheduleDraw() {
  if (drawRaf) return
  drawRaf = requestAnimationFrame(() => {
    drawRaf = 0
    drawFrame()
  })
}

function drawFrame() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container || !props.cells.length || props.rows <= 0 || props.cols <= 0) return

  const cw = container.clientWidth
  const ch = container.clientHeight
  if (cw <= 0 || ch <= 0) return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(cw * dpr)
  canvas.height = Math.round(ch * dpr)
  canvas.style.width = `${cw}px`
  canvas.style.height = `${ch}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cw, ch)

  drawBeadGrid(ctx, {
    rows: props.rows,
    cols: props.cols,
    cells: props.cells,
    hiddenColors: props.hiddenColors,
    backgroundColors: props.backgroundColors,
    selectedCells: selectedKeys.value,
    cellSize: CELL_SIZE.value,
    viewportW: cw,
    viewportH: ch,
    translateX: translateX.value,
    translateY: translateY.value,
    scale: scale.value,
  })
}

function hitTestAt(clientX: number, clientY: number) {
  const container = containerRef.value
  if (!container) return null
  return hitTestBeadCell(clientX, clientY, container.getBoundingClientRect(), {
    rows: props.rows,
    cols: props.cols,
    cellSize: CELL_SIZE.value,
    translateX: translateX.value,
    translateY: translateY.value,
    scale: scale.value,
  })
}

function toggleCellSelection(row: number, col: number) {
  const key = `${row}-${col}`
  if (!cellMap.value.has(key)) return
  const next = new Set(selectedKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedKeys.value = next
  scheduleDraw()
}

function clearSelection() {
  if (selectedKeys.value.size === 0) return
  selectedKeys.value = new Set()
  scheduleDraw()
}

function openPicker() {
  if (selectedKeys.value.size === 0) return
  pickerOpen.value = true
}

function onPickColor(color: BeadColor) {
  const keys = [...selectedKeys.value].map((key) => {
    const [row, col] = key.split('-').map(Number)
    return { row: row!, col: col! }
  })
  emit('replaceCells', keys, color)
  selectedKeys.value = new Set()
  pickerOpen.value = false
  scheduleDraw()
}

function onSelectTap(clientX: number, clientY: number) {
  const hit = hitTestAt(clientX, clientY)
  if (hit) toggleCellSelection(hit.row, hit.col)
}

let mouseTapStart: { x: number; y: number } | null = null
let mouseDragged = false

function onStageTouchStart(event: TouchEvent) {
  if (event.touches.length === 1) {
    const touch = event.touches[0]!
    tapStart = { x: touch.clientX, y: touch.clientY }
  } else {
    tapStart = null
  }
  onTouchStart(event)
}

function onStageTouchMove(event: TouchEvent) {
  if (tapStart && event.touches.length === 1) {
    const touch = event.touches[0]!
    const dist = Math.hypot(touch.clientX - tapStart.x, touch.clientY - tapStart.y)
    if (dist > TAP_THRESHOLD_PX) tapStart = null
  }
  onTouchMove(event)
}

function onStageTouchEnd(event: TouchEvent) {
  if (tapStart && event.touches.length === 0 && event.changedTouches.length >= 1) {
    const touch = event.changedTouches[0]!
    const dist = Math.hypot(touch.clientX - tapStart.x, touch.clientY - tapStart.y)
    if (dist <= TAP_THRESHOLD_PX) {
      onSelectTap(touch.clientX, touch.clientY)
      lastTouchSelectAt = Date.now()
    }
  }
  tapStart = null
  onTouchEnd(event)
}

function onStageMouseDown(event: MouseEvent) {
  if (event.button === 0) {
    mouseTapStart = { x: event.clientX, y: event.clientY }
    mouseDragged = false
  } else {
    mouseTapStart = null
    mouseDragged = false
  }
  onMouseDown(event)
}

function onStageMouseMove(event: MouseEvent) {
  if (mouseTapStart) {
    const dist = Math.hypot(event.clientX - mouseTapStart.x, event.clientY - mouseTapStart.y)
    if (dist > TAP_THRESHOLD_PX) mouseDragged = true
  }
  onMouseMove(event)
}

function onStageMouseUp(event: MouseEvent) {
  if (mouseTapStart && !mouseDragged && event.button === 0) {
    const dist = Math.hypot(event.clientX - mouseTapStart.x, event.clientY - mouseTapStart.y)
    if (dist <= TAP_THRESHOLD_PX && Date.now() - lastTouchSelectAt > 400) {
      onSelectTap(event.clientX, event.clientY)
    }
  }
  mouseTapStart = null
  mouseDragged = false
  onMouseUp()
}

watch(
  () => [props.rows, props.cols, props.cells, props.hiddenColors, props.backgroundColors, CELL_SIZE.value] as const,
  () => {
    const valid = new Set(props.cells.map((c) => `${c.row}-${c.col}`))
    const next = new Set([...selectedKeys.value].filter((k) => valid.has(k)))
    if (next.size !== selectedKeys.value.size) selectedKeys.value = next
    scheduleDraw()
  },
  { deep: true },
)

watch([scale, translateX, translateY, selectedKeys], scheduleDraw, { deep: true })

onMounted(() => {
  window.addEventListener('mousemove', onStageMouseMove)
  window.addEventListener('mouseup', onStageMouseUp)
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => scheduleDraw())
    resizeObserver.observe(containerRef.value)
  }
  requestAnimationFrame(() => {
    fitToView()
    scheduleDraw()
  })
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onStageMouseMove)
  window.removeEventListener('mouseup', onStageMouseUp)
  resizeObserver?.disconnect()
  if (drawRaf) cancelAnimationFrame(drawRaf)
})
</script>

<template>
  <div class="bead-viewport framed">
    <div class="sd-page-toolbar">
      <div class="viewport-meta">
        <span class="meta-line">{{ rows }}×{{ cols }} · {{ cells.length }} 颗</span>
        <span class="sel-badge" :class="{ visible: selectedCount > 0 }">
          已选 {{ selectedCount }}
        </span>
      </div>
      <div class="sd-toolbar-actions">
        <button
          type="button"
          class="sd-toolbar-btn accent"
          :class="{ hidden: selectedCount === 0 }"
          :tabindex="selectedCount > 0 ? 0 : -1"
          @click="openPicker"
        >
          <SdIcon name="palette" :size="12" />换色
        </button>
        <button
          type="button"
          class="sd-toolbar-btn"
          :class="{ hidden: selectedCount === 0 }"
          :tabindex="selectedCount > 0 ? 0 : -1"
          @click="clearSelection"
        >
          <SdIcon name="trash" :size="12" />清空
        </button>
        <button type="button" class="sd-toolbar-btn" @click="fitToView(); scheduleDraw()">
          <SdIcon name="fit-view" :size="12" />全览
        </button>
      </div>
    </div>

    <div
      ref="containerRef"
      class="viewport-stage sd-pixel-grid-bg"
      :class="{ 'has-selection': selectedCount > 0 }"
      @touchstart.passive="onStageTouchStart"
      @touchmove="onStageTouchMove"
      @touchend="onStageTouchEnd"
      @touchcancel="onStageTouchEnd"
      @wheel.prevent="onWheel"
      @mousedown="onStageMouseDown"
    >
      <canvas v-if="cells.length" ref="canvasRef" class="viewport-canvas" />
      <p v-else class="grid-empty sd-body sd-text-muted">暂无网格数据</p>
      <p class="viewport-hint">点击选格 · 拖动平移 · 滚轮/双指缩放</p>
      <div ref="contentRef" class="viewport-measure" aria-hidden="true" />
    </div>

    <ColorPickDialog
      :open="pickerOpen"
      :current="pickerCurrentColor"
      :colors="activeColors"
      @close="pickerOpen = false"
      @select="onPickColor"
    />
  </div>
</template>

<style scoped>
.bead-viewport {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--sd-bg);
}

.bead-viewport.framed {
  background: transparent;
}

.viewport-meta {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  min-height: 32px;
  flex-shrink: 1;
}

.meta-line {
  font-size: 11px;
  font-weight: 700;
  font-family: var(--sd-font-display);
  color: var(--sd-text);
  line-height: 1.2;
  white-space: nowrap;
}

.sel-badge {
  min-height: 14px;
  line-height: 14px;
  font-size: 10px;
  font-weight: 700;
  color: var(--sd-primary-dark);
  font-family: var(--sd-font-body);
  visibility: hidden;
}

.sel-badge.visible {
  visibility: visible;
}

.sd-toolbar-btn.hidden {
  visibility: hidden;
  pointer-events: none;
}

.viewport-stage {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  touch-action: none;
  position: relative;
}

.viewport-stage.has-selection {
  cursor: crosshair;
}

.viewport-canvas {
  position: absolute;
  inset: 0;
  display: block;
}

.viewport-measure {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
  visibility: hidden;
}

.grid-empty {
  margin: 0;
  padding: 24px 16px;
  text-align: center;
  font-size: 13px;
}

.viewport-hint {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  pointer-events: none;
  z-index: 2;
  line-height: 1.3;
  font-size: 11px;
  font-weight: 600;
  color: #8b7355;
  white-space: nowrap;
  max-width: calc(100% - 16px);
  text-align: center;
}
</style>
