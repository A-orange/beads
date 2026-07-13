<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Button } from 'animal-island-vue'
import NumericStepper from './NumericStepper.vue'
import SdIcon from './SdIcon.vue'
import { usePinchPan } from '../composables/usePinchPan'
import type { GridAlignment } from '../utils/imageAnalysis'
import {
  computeAlignDisplaySize,
  drawAlignCanvas,
  getAlignContentBounds,
} from '../utils/alignCanvas'

const GRID_COLORS = ['#ffffff', '#00ff00', '#ff00ff', '#ffff00', '#00ffff', '#ff4444']
const CELL_SIZE_MIN = 0.01
const CELL_SIZE_MAX = 200
const CELL_SIZE_DECIMALS = 2
/** 锁定态双指调整格子宽高：越小越精细（0.2 ≈  pinch 变化 10% 时格子约变 2%） */
const CELL_PINCH_SENSITIVITY = 0.1

const props = defineProps<{
  imageUrl: string
  rows: number
  cols: number
  cellWidth: number
  cellHeight: number
  gridColor: string
  /** 画布优先：控件沉底，视口占满可用空间 */
  immersive?: boolean
  /** 嵌入 page-shell 时去掉独立外框 */
  framed?: boolean
}>()

const emit = defineEmits<{
  'update:rows': [value: number]
  'update:cols': [value: number]
  'update:cellWidth': [value: number]
  'update:cellHeight': [value: number]
  'update:gridColor': [value: string]
}>()

const viewportRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const settingsOpen = ref(true)

const imageLocked = ref(false)
const sizeLinked = ref(true)
const dimensionLinked = ref(true)
const gridOffset = ref({ x: 0, y: 0 })
const imgOffset = ref({ x: 0, y: 0 })
const imgScale = ref(1)
const gridScale = ref(1)
const imgDisplaySize = ref({ w: 0, h: 0 })

const showGrid = computed(
  () => props.rows > 0 && props.cols > 0 && props.cellWidth > 0 && props.cellHeight > 0,
)

const gridPixelSize = computed(() => ({
  w: props.cols * props.cellWidth,
  h: props.rows * props.cellHeight,
}))

const contentBounds = computed(() =>
  getAlignContentBounds({
    imageDisplayW: imgDisplaySize.value.w,
    imageDisplayH: imgDisplaySize.value.h,
    imgOffsetX: imgOffset.value.x,
    imgOffsetY: imgOffset.value.y,
    imgScale: imgScale.value,
    gridOffsetX: gridOffset.value.x,
    gridOffsetY: gridOffset.value.y,
    gridScale: gridScale.value,
    rows: props.rows,
    cols: props.cols,
    cellWidth: props.cellWidth,
    cellHeight: props.cellHeight,
    showGrid: showGrid.value,
  }),
)

const {
  scale,
  translateX,
  translateY,
  fitToView,
  resetView,
  bindFitWhenReady,
} = usePinchPan(viewportRef, contentRef, { contentSize: contentBounds })

bindFitWhenReady(() => [
  props.imageUrl,
  imgDisplaySize.value.w,
  imgDisplaySize.value.h,
  props.cols,
  props.rows,
  props.immersive,
])

let drawRaf = 0
let resizeObserver: ResizeObserver | null = null

function scheduleDraw() {
  if (drawRaf) return
  drawRaf = requestAnimationFrame(() => {
    drawRaf = 0
    drawFrame()
  })
}

function drawFrame() {
  const canvas = canvasRef.value
  const viewport = viewportRef.value
  const img = imageRef.value
  if (!canvas || !viewport) return

  const vw = viewport.clientWidth
  const vh = viewport.clientHeight
  if (vw <= 0 || vh <= 0) return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(vw * dpr)
  canvas.height = Math.round(vh * dpr)
  canvas.style.width = `${vw}px`
  canvas.style.height = `${vh}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawAlignCanvas(ctx, {
    image: img?.complete && img.naturalWidth ? img : null,
    imageDisplayW: imgDisplaySize.value.w,
    imageDisplayH: imgDisplaySize.value.h,
    imgOffsetX: imgOffset.value.x,
    imgOffsetY: imgOffset.value.y,
    imgScale: imgScale.value,
    gridOffsetX: gridOffset.value.x,
    gridOffsetY: gridOffset.value.y,
    gridScale: gridScale.value,
    rows: props.rows,
    cols: props.cols,
    cellWidth: props.cellWidth,
    cellHeight: props.cellHeight,
    gridColor: props.gridColor,
    showGrid: showGrid.value,
    viewportW: vw,
    viewportH: vh,
    viewportTx: translateX.value,
    viewportTy: translateY.value,
    viewportScale: scale.value,
  })
}

const alignHint = computed(() =>
  imageLocked.value
    ? '拖动平移网格 · 滚轮/双指调整格子宽高'
    : '拖动平移 · 滚轮/双指整体缩放（宽高数值不变）',
)

const gridSizeLabel = computed(() =>
  showGrid.value
    ? `${formatSize(gridPixelSize.value.w)}×${formatSize(gridPixelSize.value.h)}`
    : null,
)

let dragging = false
let dragStart = { x: 0, y: 0 }
let gridOffsetStart = { x: 0, y: 0 }
let imgOffsetStart = { x: 0, y: 0 }

let pinchStartDist = 0
let pinchStartImgScale = 1
let pinchStartGridScale = 1
let pinchStartImgOffset = { x: 0, y: 0 }
let pinchStartCellW = 0
let pinchStartCellH = 0
let pinchStartGridOffset = { x: 0, y: 0 }
let pinchAnchorContent = { x: 0, y: 0 }

function touchDistance(touches: TouchList) {
  const a = touches[0]!
  const b = touches[1]!
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function screenToContent(clientX: number, clientY: number) {
  const viewport = viewportRef.value
  if (!viewport) return { x: 0, y: 0 }
  const rect = viewport.getBoundingClientRect()
  const s = scale.value || 1
  return {
    x: (clientX - rect.left - translateX.value) / s,
    y: (clientY - rect.top - translateY.value) / s,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundCellSize(value: number) {
  const factor = 10 ** CELL_SIZE_DECIMALS
  return clamp(Math.round(value * factor) / factor, CELL_SIZE_MIN, CELL_SIZE_MAX)
}

function formatSize(value: number) {
  return value.toFixed(CELL_SIZE_DECIMALS)
}

/** 降低双指 pinch 对格子宽高的灵敏度，便于精细对齐 */
function dampCellPinchRatio(rawRatio: number) {
  return 1 + (rawRatio - 1) * CELL_PINCH_SENSITIVITY
}

function measureImage() {
  const img = imageRef.value
  if (!img?.naturalWidth) return
  imgDisplaySize.value = computeAlignDisplaySize(img.naturalWidth, img.naturalHeight)
  requestAnimationFrame(() => {
    fitToView()
    scheduleDraw()
  })
}

function resetGridPosition() {
  gridOffset.value = { x: 0, y: 0 }
}

function resetImageTransform() {
  imgOffset.value = { x: 0, y: 0 }
  imgScale.value = 1
  gridScale.value = 1
}

function resetAll() {
  resetGridPosition()
  resetImageTransform()
  resetView()
}

function onImageLoad() {
  resetAll()
  nextTick(measureImage)
}

watch(
  () => props.imageUrl,
  () => {
    resetAll()
    nextTick(measureImage)
  },
)

function onCellWidthChange(value: number) {
  const next = roundCellSize(value)
  emit('update:cellWidth', next)
  if (sizeLinked.value) emit('update:cellHeight', next)
}

function onCellHeightChange(value: number) {
  const next = roundCellSize(value)
  emit('update:cellHeight', next)
  if (sizeLinked.value) emit('update:cellWidth', next)
}

function onColsChange(value: number) {
  emit('update:cols', value)
  if (dimensionLinked.value) emit('update:rows', value)
}

function onRowsChange(value: number) {
  emit('update:rows', value)
  if (dimensionLinked.value) emit('update:cols', value)
}

function toggleSizeLink() {
  sizeLinked.value = !sizeLinked.value
  if (sizeLinked.value) emit('update:cellHeight', roundCellSize(props.cellWidth))
}

function toggleDimensionLink() {
  dimensionLinked.value = !dimensionLinked.value
  if (dimensionLinked.value) emit('update:rows', props.cols)
}

function applyCellSize(newW: number, newH: number) {
  const w = roundCellSize(newW)
  const h = roundCellSize(sizeLinked.value ? newW : newH)
  emit('update:cellWidth', w)
  emit('update:cellHeight', sizeLinked.value ? w : h)
}

function onTouchStart(event: TouchEvent) {
  if (event.touches.length === 2) {
    dragging = false
    pinchStartDist = touchDistance(event.touches)
    const midX = (event.touches[0]!.clientX + event.touches[1]!.clientX) / 2
    const midY = (event.touches[0]!.clientY + event.touches[1]!.clientY) / 2
    pinchAnchorContent = screenToContent(midX, midY)

    pinchStartCellW = props.cellWidth
    pinchStartCellH = props.cellHeight
    pinchStartGridOffset = { ...gridOffset.value }

    if (!imageLocked.value) {
      pinchStartImgScale = imgScale.value
      pinchStartGridScale = gridScale.value
      pinchStartImgOffset = { ...imgOffset.value }
    }
    return
  }

  if (event.touches.length === 1) {
    dragging = true
    dragStart = { x: event.touches[0]!.clientX, y: event.touches[0]!.clientY }
    gridOffsetStart = { ...gridOffset.value }
    imgOffsetStart = { ...imgOffset.value }
  }
}

function onTouchMove(event: TouchEvent) {
  if (event.touches.length === 2 && pinchStartDist > 0) {
    event.preventDefault()
    const dist = touchDistance(event.touches)
    const ratio = dist / pinchStartDist

    if (imageLocked.value) {
      const damped = dampCellPinchRatio(ratio)
      applyCellSize(pinchStartCellW * damped, pinchStartCellH * damped)
    } else {
      const newImgScale = clamp(pinchStartImgScale * ratio, 0.1, 10)
      const newGridScale = clamp(pinchStartGridScale * ratio, 0.1, 10)

      const imgLocalX = (pinchAnchorContent.x - pinchStartImgOffset.x) / pinchStartImgScale
      const imgLocalY = (pinchAnchorContent.y - pinchStartImgOffset.y) / pinchStartImgScale
      imgScale.value = newImgScale
      imgOffset.value = {
        x: pinchAnchorContent.x - imgLocalX * newImgScale,
        y: pinchAnchorContent.y - imgLocalY * newImgScale,
      }

      const gridLocalX = (pinchAnchorContent.x - pinchStartGridOffset.x) / pinchStartGridScale
      const gridLocalY = (pinchAnchorContent.y - pinchStartGridOffset.y) / pinchStartGridScale
      gridScale.value = newGridScale
      gridOffset.value = {
        x: pinchAnchorContent.x - gridLocalX * newGridScale,
        y: pinchAnchorContent.y - gridLocalY * newGridScale,
      }
    }
    scheduleDraw()
    return
  }

  if (dragging && event.touches.length === 1) {
    event.preventDefault()
    const s = scale.value || 1
    const dx = (event.touches[0]!.clientX - dragStart.x) / s
    const dy = (event.touches[0]!.clientY - dragStart.y) / s

    if (imageLocked.value && showGrid.value) {
      gridOffset.value = {
        x: gridOffsetStart.x + dx,
        y: gridOffsetStart.y + dy,
      }
    } else if (!imageLocked.value) {
      imgOffset.value = {
        x: imgOffsetStart.x + dx,
        y: imgOffsetStart.y + dy,
      }
      if (showGrid.value) {
        gridOffset.value = {
          x: gridOffsetStart.x + dx,
          y: gridOffsetStart.y + dy,
        }
      }
    }
    scheduleDraw()
  }
}

function onTouchEnd(event: TouchEvent) {
  if (event.touches.length < 2) pinchStartDist = 0
  if (event.touches.length === 0) dragging = false
}

function onWheel(event: WheelEvent) {
  event.preventDefault()
  const ratio = Math.exp(-event.deltaY * 0.002)
  const anchor = screenToContent(event.clientX, event.clientY)

  if (imageLocked.value && showGrid.value) {
    const damped = dampCellPinchRatio(ratio)
    applyCellSize(props.cellWidth * damped, props.cellHeight * damped)
  } else if (!imageLocked.value) {
    const newImgScale = clamp(imgScale.value * ratio, 0.1, 10)
    const newGridScale = clamp(gridScale.value * ratio, 0.1, 10)

    const imgLocalX = (anchor.x - imgOffset.value.x) / imgScale.value
    const imgLocalY = (anchor.y - imgOffset.value.y) / imgScale.value
    imgScale.value = newImgScale
    imgOffset.value = {
      x: anchor.x - imgLocalX * newImgScale,
      y: anchor.y - imgLocalY * newImgScale,
    }

    const gridLocalX = (anchor.x - gridOffset.value.x) / gridScale.value
    const gridLocalY = (anchor.y - gridOffset.value.y) / gridScale.value
    gridScale.value = newGridScale
    gridOffset.value = {
      x: anchor.x - gridLocalX * newGridScale,
      y: anchor.y - gridLocalY * newGridScale,
    }
  }
  scheduleDraw()
}

function onMouseDown(event: MouseEvent) {
  if (event.button !== 0) return
  if (imageLocked.value && !showGrid.value) return
  dragging = true
  dragStart = { x: event.clientX, y: event.clientY }
  gridOffsetStart = { ...gridOffset.value }
  imgOffsetStart = { ...imgOffset.value }
  event.preventDefault()
}

function onMouseMove(event: MouseEvent) {
  if (!dragging) return
  const s = scale.value || 1
  const dx = (event.clientX - dragStart.x) / s
  const dy = (event.clientY - dragStart.y) / s

  if (imageLocked.value && showGrid.value) {
    gridOffset.value = {
      x: gridOffsetStart.x + dx,
      y: gridOffsetStart.y + dy,
    }
  } else if (!imageLocked.value) {
    imgOffset.value = {
      x: imgOffsetStart.x + dx,
      y: imgOffsetStart.y + dy,
    }
    if (showGrid.value) {
      gridOffset.value = {
        x: gridOffsetStart.x + dx,
        y: gridOffsetStart.y + dy,
      }
    }
  }
  scheduleDraw()
}

function onMouseUp() {
  dragging = false
}

function getGridAlignment(): GridAlignment {
  const img = imageRef.value
  if (!img?.naturalWidth) {
    return {
      offsetX: 0,
      offsetY: 0,
      cellWidth: 0,
      cellHeight: 0,
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageScale: 1,
      gridScale: 1,
      displayWidth: 0,
      displayHeight: 0,
    }
  }

  return {
    offsetX: gridOffset.value.x,
    offsetY: gridOffset.value.y,
    cellWidth: props.cellWidth,
    cellHeight: props.cellHeight,
    imageOffsetX: imgOffset.value.x,
    imageOffsetY: imgOffset.value.y,
    imageScale: imgScale.value,
    gridScale: gridScale.value,
    displayWidth: imgDisplaySize.value.w,
    displayHeight: imgDisplaySize.value.h,
  }
}

watch(settingsOpen, () => scheduleDraw())

watch(
  () =>
    [
      props.rows,
      props.cols,
      props.cellWidth,
      props.cellHeight,
      props.gridColor,
      imgScale.value,
      gridScale.value,
      imgOffset.value,
      gridOffset.value,
      imgDisplaySize.value,
      imageLocked.value,
    ] as const,
  scheduleDraw,
  { deep: true },
)

watch([scale, translateX, translateY], scheduleDraw)

onMounted(() => {
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('mousemove', onMouseMove)
  if (viewportRef.value) {
    resizeObserver = new ResizeObserver(() => scheduleDraw())
    resizeObserver.observe(viewportRef.value)
  }
  scheduleDraw()
})

onUnmounted(() => {
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('mousemove', onMouseMove)
  resizeObserver?.disconnect()
  if (drawRaf) cancelAnimationFrame(drawRaf)
})

defineExpose({ imageRef, getGridAlignment, resetGridPosition })
</script>

<template>
  <div
    class="grid-align-editor variant-pixel"
    :class="{ immersive: immersive, framed: framed }"
  >
    <!-- 画布区域优先 -->
    <div class="align-stage">
      <div class="sd-page-toolbar">
        <button
          type="button"
          class="sd-toolbar-btn"
          :class="{ 'is-primary': imageLocked }"
          @click="imageLocked = !imageLocked"
        >
          <SdIcon :name="imageLocked ? 'lock' : 'unlock'" :size="12" />
          {{ imageLocked ? '已锁定' : '锁定图片' }}
        </button>
        <button
          type="button"
          class="sd-toolbar-btn toolbar-settings-btn"
          :aria-expanded="settingsOpen"
          :title="settingsOpen ? '收起网格设置' : '展开网格设置'"
          @click="settingsOpen = !settingsOpen"
        >
          <SdIcon name="settings" :size="12" />
          <span class="settings-toggle-label">网格设置</span>
          <span class="settings-chevron" :class="{ up: settingsOpen }">
            <SdIcon name="chevron-down" :size="12" />
          </span>
        </button>
      </div>

      <div v-show="settingsOpen" class="settings-panel">
        <div class="settings-body">
          <div class="row-cols">
            <label class="field">
              <span>列</span>
              <NumericStepper
                compact
                :model-value="cols"
                :min="1"
                :max="300"
                @update:model-value="onColsChange"
              />
            </label>
            <button
              type="button"
              class="link-btn"
              :class="{ linked: dimensionLinked }"
              :title="dimensionLinked ? '行列相同，点击取消' : '点击使行列相同'"
              @click="toggleDimensionLink"
            >
              <SdIcon name="link" :size="14" />
            </button>
            <label class="field">
              <span>行</span>
              <NumericStepper
                compact
                :model-value="rows"
                :min="1"
                :max="300"
                @update:model-value="onRowsChange"
              />
            </label>
          </div>

          <div class="row-size">
            <label class="field">
              <span>宽</span>
              <NumericStepper
                compact
                :decimals="2"
                :step="1"
                :model-value="cellWidth"
                :min="CELL_SIZE_MIN"
                :max="CELL_SIZE_MAX"
                @update:model-value="onCellWidthChange"
              />
            </label>
            <button
              type="button"
              class="link-btn"
              :class="{ linked: sizeLinked }"
              :title="sizeLinked ? '宽高相同，点击取消' : '点击使宽高相同'"
              @click="toggleSizeLink"
            >
              <SdIcon name="link" :size="14" />
            </button>
            <label class="field">
              <span>高</span>
              <NumericStepper
                compact
                :decimals="2"
                :step="1"
                :model-value="cellHeight"
                :min="CELL_SIZE_MIN"
                :max="CELL_SIZE_MAX"
                @update:model-value="onCellHeightChange"
              />
            </label>
          </div>

          <div class="color-row">
            <span class="control-label">网格色</span>
            <div class="color-swatches">
              <button
                v-for="c in GRID_COLORS"
                :key="c"
                type="button"
                class="color-swatch"
                :class="{ active: gridColor === c }"
                :style="{ backgroundColor: c }"
                :title="c"
                @click="emit('update:gridColor', c)"
              >
                <SdIcon v-if="gridColor === c" name="check" :size="10" class="swatch-check" />
              </button>
              <input
                type="color"
                class="color-picker"
                :value="gridColor"
                title="自定义颜色"
                @input="emit('update:gridColor', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>

          <div class="control-actions">
            <Button size="small" type="default" @click="resetGridPosition">
              <span class="sd-btn-inner"><SdIcon name="reset-grid" :size="12" />重置网格</span>
            </Button>
            <Button size="small" type="default" @click="resetImageTransform">
              <span class="sd-btn-inner"><SdIcon name="reset-image" :size="12" />重置图片</span>
            </Button>
            <Button size="small" type="default" @click="resetView(); scheduleDraw()">
              <span class="sd-btn-inner"><SdIcon name="fit-view" :size="12" />适应窗口</span>
            </Button>
          </div>
        </div>
      </div>

      <div
        ref="viewportRef"
        class="align-viewport"
        @touchstart.passive="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
        @wheel.prevent="onWheel"
        @mousedown="onMouseDown"
      >
        <canvas ref="canvasRef" class="align-canvas" />
        <p class="viewport-hint">{{ alignHint }}</p>
        <p v-if="gridSizeLabel" class="viewport-meta">{{ gridSizeLabel }}</p>
        <img
          ref="imageRef"
          class="analysis-source"
          :src="imageUrl"
          alt=""
          draggable="false"
          decoding="async"
          @load="onImageLoad"
        />
        <div ref="contentRef" class="align-measure" aria-hidden="true" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid-align-editor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 画布优先布局 */
.align-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.toolbar-settings-btn {
  margin-left: auto;
}

.settings-toggle-label {
  white-space: nowrap;
}

.settings-chevron {
  transition: transform 0.2s;
}

.settings-chevron.up {
  transform: rotate(180deg);
}

.settings-panel {
  flex-shrink: 0;
  background: var(--sd-surface, #fff8ee);
  border-bottom: 2px solid var(--sd-border-light, #c4a882);
}

.settings-body {
  padding: 8px 8px 10px;
}

.row-cols {
  display: grid;
  grid-template-columns: 1fr 26px 1fr;
  gap: 4px;
  align-items: end;
  margin-bottom: 6px;
}

.row-size {
  display: grid;
  grid-template-columns: 1fr 26px 1fr;
  gap: 4px;
  align-items: end;
  margin-bottom: 8px;
}

.align-viewport {
  flex: 1;
  min-height: 120px;
  overflow: hidden;
  touch-action: none;
  background: #f0f2f5;
  border-radius: 8px;
  position: relative;
}

.align-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.viewport-hint,
.viewport-meta {
  position: absolute;
  margin: 0;
  pointer-events: none;
  z-index: 2;
  line-height: 1.3;
}

.viewport-hint {
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  font-weight: 600;
  color: #8b7355;
  white-space: nowrap;
  max-width: calc(100% - 16px);
  text-align: center;
}

.viewport-meta {
  bottom: 10px;
  right: 10px;
  font-size: 10px;
  font-weight: 700;
  color: #6f4e37;
}

.analysis-source {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
}

.align-measure {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
  visibility: hidden;
}

/* 设置面板字段 */
.field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.field span,
.control-label {
  font-size: 10px;
  font-weight: 600;
  color: #606266;
  text-align: center;
}

.link-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin-bottom: 2px;
  padding: 0;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  color: #909399;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.link-btn.linked {
  color: var(--sd-primary, #5fa044);
  border-color: var(--sd-primary, #5fa044);
  background: rgba(95, 160, 68, 0.08);
}

.control-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px dashed #dcdfe6;
}

.color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.color-row .control-label {
  flex-shrink: 0;
  text-align: left;
}

.color-swatches {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.color-swatch {
  width: 22px;
  height: 22px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.swatch-check {
  color: #fff;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.8));
}

.color-swatch.active {
  outline: 2px solid var(--sd-primary, #5fa044);
  outline-offset: 1px;
}

.color-picker {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

/* Immersive：全屏画布模式 */
.grid-align-editor.immersive {
  height: 100%;
}

.immersive .align-stage {
  flex: 1;
  min-height: 0;
}

.framed.immersive .settings-panel {
  border: none;
  border-bottom: var(--sd-border-width) solid var(--sd-wood);
  background: var(--sd-surface);
}

.framed.immersive .align-viewport {
  flex: 1;
  min-height: 0;
  border: none;
  border-radius: 0;
  box-shadow: none;
  background: var(--sd-bg);
}

.immersive .align-viewport {
  flex: 1;
  min-height: 0;
  border-radius: 0;
  border: none;
}

/* Pixel variant */
.variant-pixel .field span,
.variant-pixel .control-label {
  font-size: 10px;
  color: var(--sd-text, #3e2723);
}

.variant-pixel .link-btn {
  border-color: var(--sd-border-light, #c4a882);
  background: var(--sd-bg-panel, #fff8e7);
  color: var(--sd-text, #3e2723);
  box-shadow: 1px 1px 0 0 var(--sd-shadow, #5c4033);
  border-radius: 0;
}

.variant-pixel .link-btn.linked {
  background: var(--sd-primary, #5fa044);
  border-color: var(--sd-border, #8b6914);
  color: #fff;
}

.variant-pixel .control-actions {
  border-top-color: var(--sd-border-light, #c4a882);
}

.variant-pixel .align-viewport {
  background: var(--sd-bg, #f5e6c8);
}

.variant-pixel.immersive .align-viewport {
  box-shadow: inset 3px 3px 0 0 rgba(92, 64, 51, 0.1);
}

.framed.immersive .align-viewport {
  box-shadow: none;
}

.variant-pixel .color-swatch {
  border-color: var(--sd-border-light, #c4a882);
  box-shadow: 1px 1px 0 0 var(--sd-shadow, #5c4033);
}
</style>
