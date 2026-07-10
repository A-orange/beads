<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Button } from '@pixelium/web-vue/es'
import NumericStepper from './NumericStepper.vue'
import { usePinchPan } from '../composables/usePinchPan'
import type { GridAlignment } from '../utils/imageAnalysis'

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
  variant?: 'default' | 'pixel'
  /** 画布优先：控件沉底，视口占满可用空间 */
  immersive?: boolean
}>()

const emit = defineEmits<{
  'update:rows': [value: number]
  'update:cols': [value: number]
  'update:cellWidth': [value: number]
  'update:cellHeight': [value: number]
  'update:gridColor': [value: string]
}>()

const viewportRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const dockExpanded = ref(false)

const imageLocked = ref(false)
const sizeLinked = ref(true)
const dimensionLinked = ref(true)
const gridOffset = ref({ x: 0, y: 0 })
const imgOffset = ref({ x: 0, y: 0 })
const imgScale = ref(1)
const gridScale = ref(1)
const imgDisplaySize = ref({ w: 0, h: 0 })

const {
  scale,
  translateX,
  translateY,
  transformStyle,
  fitToView,
  resetView,
  bindFitWhenReady,
} = usePinchPan(viewportRef, contentRef)

bindFitWhenReady(() => [
  props.imageUrl,
  imgDisplaySize.value.w,
  imgDisplaySize.value.h,
  props.cols,
  props.rows,
  props.immersive,
])

const showGrid = computed(
  () => props.rows > 0 && props.cols > 0 && props.cellWidth > 0 && props.cellHeight > 0,
)

const gridPixelSize = computed(() => ({
  w: props.cols * props.cellWidth,
  h: props.rows * props.cellHeight,
}))

const contentSize = computed(() => ({
  w: Math.max(
    imgDisplaySize.value.w * imgScale.value,
    gridOffset.value.x + gridPixelSize.value.w * gridScale.value,
  ),
  h: Math.max(
    imgDisplaySize.value.h * imgScale.value,
    gridOffset.value.y + gridPixelSize.value.h * gridScale.value,
  ),
}))

const imageTransformStyle = computed(() => ({
  transform: `translate(${imgOffset.value.x}px, ${imgOffset.value.y}px) scale(${imgScale.value})`,
  transformOrigin: '0 0',
}))

const verticalLines = computed(() => {
  if (!showGrid.value) return []
  return Array.from({ length: props.cols - 1 }, (_, i) => ((i + 1) / props.cols) * 100)
})

const horizontalLines = computed(() => {
  if (!showGrid.value) return []
  return Array.from({ length: props.rows - 1 }, (_, i) => ((i + 1) / props.rows) * 100)
})

const gridOverlayStyle = computed(() => ({
  left: `${gridOffset.value.x}px`,
  top: `${gridOffset.value.y}px`,
  width: `${gridPixelSize.value.w}px`,
  height: `${gridPixelSize.value.h}px`,
  transform: `scale(${gridScale.value})`,
  transformOrigin: '0 0',
  '--grid-color': props.gridColor,
}))

const alignHint = computed(() =>
  imageLocked.value
    ? '单指拖网格 · 双指调整格子宽高'
    : '单指拖动 · 双指整体缩放（宽高数值不变）',
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
  if (!img?.clientWidth) return
  imgDisplaySize.value = { w: img.clientWidth, h: img.clientHeight }
  requestAnimationFrame(() => fitToView())
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
      const ratio = dampCellPinchRatio(dist / pinchStartDist)
      applyCellSize(pinchStartCellW * ratio, pinchStartCellH * ratio)
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
  }
}

function onTouchEnd(event: TouchEvent) {
  if (event.touches.length < 2) pinchStartDist = 0
  if (event.touches.length === 0) dragging = false
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
  }
}

onMounted(() => {
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('mousemove', onMouseMove)
})

onUnmounted(() => {
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('mousemove', onMouseMove)
})

defineExpose({ imageRef, getGridAlignment, resetGridPosition })
</script>

<template>
  <div
    class="grid-align-editor"
    :class="{
      'variant-pixel': variant === 'pixel',
      immersive: immersive,
      expanded: dockExpanded || !immersive,
    }"
  >
    <!-- 画布区域优先 -->
    <div class="align-stage">
      <div class="stage-bar">
        <button
          type="button"
          class="lock-btn"
          :class="{ locked: imageLocked }"
          @click="imageLocked = !imageLocked"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              v-if="imageLocked"
              fill="currentColor"
              d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"
            />
            <path
              v-else
              fill="currentColor"
              d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z"
            />
          </svg>
          {{ imageLocked ? '已锁定' : '锁定图片' }}
        </button>
        <span class="stage-hint">{{ alignHint }}</span>
        <span v-if="showGrid" class="stage-meta">
          {{ formatSize(gridPixelSize.w) }}×{{ formatSize(gridPixelSize.h) }}
        </span>
      </div>

      <div
        ref="viewportRef"
        class="align-viewport"
        @touchstart.passive="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
        @mousedown="onMouseDown"
      >
        <div
          ref="contentRef"
          class="align-content"
          :style="{
            ...transformStyle,
            width: contentSize.w + 'px',
            height: contentSize.h + 'px',
          }"
        >
          <div class="image-layer" :style="imageTransformStyle">
            <img
              ref="imageRef"
              :src="imageUrl"
              alt="拼豆图纸"
              draggable="false"
              @load="onImageLoad"
            />
          </div>
          <svg
            v-if="showGrid"
            class="grid-overlay"
            :style="gridOverlayStyle"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <line
              v-for="(pos, i) in verticalLines"
              :key="'v' + i"
              :x1="pos"
              y1="0"
              :x2="pos"
              y2="100"
            />
            <line
              v-for="(pos, i) in horizontalLines"
              :key="'h' + i"
              x1="0"
              :y1="pos"
              x2="100"
              :y2="pos"
            />
            <rect class="grid-border" x="0" y="0" width="100" height="100" />
          </svg>
        </div>
      </div>
    </div>

    <!-- 控件沉底 -->
    <div class="align-dock">
      <button
        v-if="immersive"
        type="button"
        class="dock-toggle"
        :aria-expanded="dockExpanded"
        @click.stop="dockExpanded = !dockExpanded"
      >
        <span>{{ dockExpanded ? '收起' : '更多设置' }}</span>
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          aria-hidden="true"
          :class="{ up: dockExpanded }"
        >
          <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
        </svg>
      </button>

      <div class="dock-body">
        <div class="row-cols">
          <label class="field">
            <span>列</span>
            <NumericStepper
              compact
              :model-value="cols"
              :min="1"
              :max="300"
              :variant="variant"
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
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                v-if="dimensionLinked"
                fill="currentColor"
                d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 0H7C4.24 7 2 9.24 2 12s2.24 5 5 5h4v-2H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7zm-1 4h6v2h-6v-2z"
              />
              <path
                v-else
                fill="currentColor"
                d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 0H7C4.24 7 2 9.24 2 12s2.24 5 5 5h4v-2H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7z"
              />
            </svg>
          </button>
          <label class="field">
            <span>行</span>
            <NumericStepper
              compact
              :model-value="rows"
              :min="1"
              :max="300"
              :variant="variant"
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
              :step="0.01"
              :model-value="cellWidth"
              :min="CELL_SIZE_MIN"
              :max="CELL_SIZE_MAX"
              :variant="variant"
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
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                v-if="sizeLinked"
                fill="currentColor"
                d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 0H7C4.24 7 2 9.24 2 12s2.24 5 5 5h4v-2H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7zm-1 4h6v2h-6v-2z"
              />
              <path
                v-else
                fill="currentColor"
                d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 0H7C4.24 7 2 9.24 2 12s2.24 5 5 5h4v-2H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7z"
              />
            </svg>
          </button>
          <label class="field">
            <span>高</span>
            <NumericStepper
              compact
              :decimals="2"
              :step="0.01"
              :model-value="cellHeight"
              :min="CELL_SIZE_MIN"
              :max="CELL_SIZE_MAX"
              :variant="variant"
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
            />
            <input
              type="color"
              class="color-picker"
              :value="gridColor"
              title="自定义颜色"
              @input="emit('update:gridColor', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>

        <div class="dock-extra">
          <div class="control-actions">
            <Button
              v-if="variant === 'pixel'"
              size="small"
              variant="outline"
              theme="notice"
              @click="resetGridPosition"
            >
              重置网格
            </Button>
            <el-button v-else size="small" @click="resetGridPosition">重置网格</el-button>
            <Button
              v-if="variant === 'pixel'"
              size="small"
              variant="outline"
              theme="notice"
              @click="resetImageTransform"
            >
              重置图片
            </Button>
            <el-button v-else size="small" @click="resetImageTransform">重置图片</el-button>
            <Button
              v-if="variant === 'pixel'"
              size="small"
              variant="outline"
              theme="info"
              @click="resetView()"
            >
              适应窗口
            </Button>
            <el-button v-else size="small" @click="resetView()">适应窗口</el-button>
          </div>
        </div>
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

.stage-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  min-height: 36px;
}

.stage-hint {
  flex: 1;
  font-size: 11px;
  color: #909399;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stage-meta {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  color: #909399;
  font-variant-numeric: tabular-nums;
}

.lock-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  color: #606266;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.lock-btn.locked {
  color: #fff;
  background: var(--sd-primary, #5fa044);
  border-color: var(--sd-primary, #5fa044);
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

.align-content {
  position: absolute;
  top: 0;
  left: 0;
}

.image-layer {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
}

.image-layer img {
  display: block;
  max-width: none;
  width: auto;
  height: auto;
  user-select: none;
  pointer-events: none;
}

.grid-overlay {
  position: absolute;
  pointer-events: none;
  overflow: visible;
}

.grid-overlay line {
  stroke: var(--grid-color, #ffffff);
  stroke-width: 1.2;
  vector-effect: non-scaling-stroke;
  shape-rendering: crispEdges;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.85));
}

.grid-overlay .grid-border {
  fill: none;
  stroke: var(--grid-color, #ffffff);
  stroke-width: 1.8;
  vector-effect: non-scaling-stroke;
  shape-rendering: crispEdges;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.85));
}

/* 底部控件区 */
.align-dock {
  flex-shrink: 0;
}

.dock-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  border: none;
  border-top: 1px solid #e4e7ed;
  background: #fff;
  color: #606266;
  cursor: pointer;
}

.dock-toggle svg {
  transition: transform 0.2s;
}

.dock-toggle svg.up {
  transform: rotate(180deg);
}

.dock-body {
  padding: 8px 8px 8px;
}

.grid-align-editor.immersive:not(.expanded) .dock-extra {
  display: none;
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

.dock-extra {
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

.control-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* Immersive：全屏画布模式 */
.grid-align-editor.immersive {
  height: 100%;
}

.immersive .align-stage {
  flex: 1;
  min-height: 0;
}

.immersive .stage-bar {
  padding: 8px 10px;
  background: var(--sd-surface, #fff8ee);
  border-bottom: 2px solid var(--sd-border-light, #c4a882);
}

.immersive .align-viewport {
  flex: 1;
  min-height: 0;
  border-radius: 0;
  border: none;
}

.immersive .align-dock {
  background: var(--sd-surface, #fff8ee);
  border-top: 3px solid var(--sd-border, #8b6914);
  box-shadow: 0 -4px 12px rgba(92, 64, 51, 0.08);
}

.immersive .dock-toggle {
  border-top: none;
  background: var(--sd-bg-alt, #e8d4a8);
  color: var(--sd-text, #3e2723);
  min-height: 36px;
}

.immersive .dock-body {
  padding-bottom: 8px;
}

.immersive.expanded .dock-body {
  padding-top: 0;
}

/* Pixel variant */
.variant-pixel .field span,
.variant-pixel .control-label {
  font-size: 10px;
  color: var(--sd-text, #3e2723);
}

.variant-pixel .stage-hint,
.variant-pixel .stage-meta {
  color: var(--sd-text-muted, #7a6a52);
}

.variant-pixel .link-btn,
.variant-pixel .lock-btn {
  border-color: var(--sd-border-light, #c4a882);
  background: var(--sd-bg-panel, #fff8e7);
  color: var(--sd-text, #3e2723);
  box-shadow: 1px 1px 0 0 var(--sd-shadow, #5c4033);
  border-radius: 0;
}

.variant-pixel .dock-extra {
  border-top-color: var(--sd-border-light, #c4a882);
}

.variant-pixel .link-btn.linked,
.variant-pixel .lock-btn.locked {
  background: var(--sd-primary, #5fa044);
  border-color: var(--sd-border, #8b6914);
  color: #fff;
}

.variant-pixel .align-viewport {
  background: var(--sd-bg, #f5e6c8);
}

.variant-pixel.immersive .align-viewport {
  box-shadow: inset 3px 3px 0 0 rgba(92, 64, 51, 0.1);
}

.variant-pixel .color-swatch {
  border-color: var(--sd-border-light, #c4a882);
  box-shadow: 1px 1px 0 0 var(--sd-shadow, #5c4033);
}

/* 桌面端非 immersive 也画布优先 */
.grid-align-editor:not(.immersive) .align-viewport {
  min-height: 280px;
}

.grid-align-editor:not(.immersive) .dock-toggle {
  display: none;
}

.grid-align-editor:not(.immersive) .dock-body {
  padding-top: 8px;
}
</style>
