<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
import { Button, InputNumber } from '@pixelium/web-vue/es'
import type { UploadFile } from 'element-plus'
import type { SelectionRect } from '../utils/imageAnalysis'

export type SelectorMode = 'upload' | 'select' | 'adjust'

const props = defineProps<{
  mode: SelectorMode
  rows: number
  cols: number
  detecting?: boolean
  showAnalyze?: boolean
  variant?: 'default' | 'pixel'
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

function openFilePicker() {
  fileInputRef.value?.click()
}

function onPixelFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file?.type.startsWith('image/')) handleFileChange(file)
  input.value = ''
}

const emit = defineEmits<{
  analyze: [selection: SelectionRect]
  detect: [selection: SelectionRect]
  uploaded: []
  'selection-change': [hasSelection: boolean]
  'update:rows': [value: number]
  'update:cols': [value: number]
}>()

const imageUrl = ref<string | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const selection = ref<SelectionRect | null>(null)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const currentDrag = ref({ x: 0, y: 0 })

const displaySelection = computed(() => {
  if (!selection.value && isDragging.value) {
    const x = Math.min(dragStart.value.x, currentDrag.value.x)
    const y = Math.min(dragStart.value.y, currentDrag.value.y)
    const width = Math.abs(currentDrag.value.x - dragStart.value.x)
    const height = Math.abs(currentDrag.value.y - dragStart.value.y)
    return { x, y, width, height }
  }
  return selection.value
})

const showGrid = computed(
  () =>
    props.mode === 'adjust' &&
    Boolean(displaySelection.value && props.rows > 0 && props.cols > 0),
)

const verticalLines = computed(() => {
  if (!showGrid.value || !props.cols) return []
  return Array.from({ length: props.cols - 1 }, (_, i) => ((i + 1) / props.cols) * 100)
})

const horizontalLines = computed(() => {
  if (!showGrid.value || !props.rows) return []
  return Array.from({ length: props.rows - 1 }, (_, i) => ((i + 1) / props.rows) * 100)
})

const canInteract = computed(() => props.mode === 'select' || props.mode === 'adjust')

function handleFileChange(file: File) {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = URL.createObjectURL(file)
  selection.value = null
  emit('update:rows', 0)
  emit('update:cols', 0)
  emit('selection-change', false)
  emit('uploaded')
}

function onUploadChange(uploadFile: UploadFile) {
  if (uploadFile.raw) handleFileChange(uploadFile.raw)
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files[0]
  if (file?.type.startsWith('image/')) handleFileChange(file)
}

function getRelativePos(clientX: number, clientY: number) {
  const img = imageRef.value
  if (!img) return { x: 0, y: 0 }

  const rect = img.getBoundingClientRect()
  return {
    x: Math.max(0, Math.min(clientX - rect.left, rect.width)),
    y: Math.max(0, Math.min(clientY - rect.top, rect.height)),
  }
}

function pointerDown(clientX: number, clientY: number) {
  if (!imageUrl.value || !canInteract.value) return
  isDragging.value = true
  const pos = getRelativePos(clientX, clientY)
  dragStart.value = pos
  currentDrag.value = pos
}

function pointerMove(clientX: number, clientY: number) {
  if (!isDragging.value) return
  currentDrag.value = getRelativePos(clientX, clientY)
}

function pointerUp() {
  if (!isDragging.value) return
  isDragging.value = false

  const x = Math.min(dragStart.value.x, currentDrag.value.x)
  const y = Math.min(dragStart.value.y, currentDrag.value.y)
  const width = Math.abs(currentDrag.value.x - dragStart.value.x)
  const height = Math.abs(currentDrag.value.y - dragStart.value.y)

  if (width > 10 && height > 10) {
    selection.value = { x, y, width, height }
    emit('selection-change', true)
    const natural = toNaturalSelection()
    if (natural) emit('detect', natural)
  }
}

function onMouseDown(event: MouseEvent) {
  pointerDown(event.clientX, event.clientY)
}

function onMouseMove(event: MouseEvent) {
  pointerMove(event.clientX, event.clientY)
}

function onTouchStart(event: TouchEvent) {
  if (event.touches.length !== 1) return
  const touch = event.touches[0]!
  pointerDown(touch.clientX, touch.clientY)
}

function onTouchMove(event: TouchEvent) {
  if (!isDragging.value || event.touches.length !== 1) return
  event.preventDefault()
  const touch = event.touches[0]!
  pointerMove(touch.clientX, touch.clientY)
}

function toNaturalSelection(): SelectionRect | null {
  const img = imageRef.value
  const sel = selection.value
  if (!img || !sel) return null

  const scaleX = img.naturalWidth / img.clientWidth
  const scaleY = img.naturalHeight / img.clientHeight

  return {
    x: Math.round(sel.x * scaleX),
    y: Math.round(sel.y * scaleY),
    width: Math.round(sel.width * scaleX),
    height: Math.round(sel.height * scaleY),
  }
}

function handleAnalyze() {
  const natural = toNaturalSelection()
  if (natural) emit('analyze', natural)
}

function handleDetect() {
  const natural = toNaturalSelection()
  if (natural) emit('detect', natural)
}

function resetImage() {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = null
  selection.value = null
  emit('update:rows', 0)
  emit('update:cols', 0)
  emit('selection-change', false)
}

onMounted(() => {
  window.addEventListener('mouseup', pointerUp)
  window.addEventListener('touchend', pointerUp)
})

onUnmounted(() => {
  window.removeEventListener('mouseup', pointerUp)
  window.removeEventListener('touchend', pointerUp)
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
})

function setSelectionNatural(rect: SelectionRect) {
  const img = imageRef.value
  if (!img?.naturalWidth) return

  const scaleX = img.clientWidth / img.naturalWidth
  const scaleY = img.clientHeight / img.naturalHeight
  selection.value = {
    x: rect.x * scaleX,
    y: rect.y * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  }
  emit('selection-change', true)
}

defineExpose({
  imageRef,
  getSelection: toNaturalSelection,
  resetImage,
  hasImage: () => !!imageUrl.value,
  setSelectionNatural,
})
</script>

<template>
  <div class="image-selector" :class="[`mode-${mode}`, variant === 'pixel' ? 'variant-pixel' : '']">
    <div
      v-if="!imageUrl"
      class="upload-area"
      @dragover.prevent
      @drop="onDrop"
    >
      <template v-if="variant === 'pixel'">
        <div class="pixel-upload pixel-panel">
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            hidden
            @change="onPixelFileChange"
          />
          <svg class="pixel-upload-icon" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="4" y="20" width="24" height="4" fill="currentColor" />
            <rect x="14" y="8" width="4" height="12" fill="currentColor" />
            <rect x="10" y="12" width="4" height="4" fill="currentColor" />
            <rect x="18" y="12" width="4" height="4" fill="currentColor" />
          </svg>
          <p class="upload-title pixel-heading">上传拼豆图纸</p>
          <p class="upload-desc pixel-body pixel-text-muted">从相册选择图片文件</p>
          <Button block theme="primary" size="large" @click="openFilePicker">
            选择图片
          </Button>
        </div>
      </template>
      <el-upload
        v-else
        drag
        :auto-upload="false"
        :show-file-list="false"
        accept="image/*"
        @change="onUploadChange"
      >
        <div class="upload-content">
          <el-icon :size="56" color="#409eff"><UploadFilled /></el-icon>
          <p class="upload-title">上传拼豆图纸</p>
          <p class="upload-desc">点击或拖拽图片到此处</p>
        </div>
      </el-upload>
    </div>

    <div v-else-if="imageUrl" class="image-workspace">
      <div v-if="mode === 'adjust'" class="grid-controls">
        <div class="grid-control-row">
          <label>
            <span>列数</span>
            <InputNumber
              v-if="variant === 'pixel'"
              :model-value="cols"
              :min="1"
              :max="300"
              button-placement="both"
              size="small"
              @update:model-value="emit('update:cols', $event ?? 0)"
            />
            <el-input-number
              v-else
              :model-value="cols"
              :min="1"
              :max="300"
              controls-position="right"
              @update:model-value="emit('update:cols', $event ?? 0)"
            />
          </label>
          <label>
            <span>行数</span>
            <InputNumber
              v-if="variant === 'pixel'"
              :model-value="rows"
              :min="1"
              :max="300"
              button-placement="both"
              size="small"
              @update:model-value="emit('update:rows', $event ?? 0)"
            />
            <el-input-number
              v-else
              :model-value="rows"
              :min="1"
              :max="300"
              controls-position="right"
              @update:model-value="emit('update:rows', $event ?? 0)"
            />
          </label>
        </div>
        <Button
          v-if="variant === 'pixel'"
          block
          variant="outline"
          theme="notice"
          :loading="detecting"
          class="detect-btn"
          @click="handleDetect"
        >
          自动识别网格
        </Button>
        <el-button v-else class="detect-btn" :loading="detecting" @click="handleDetect">
          自动识别网格
        </el-button>
        <Button
          v-if="variant === 'pixel' && showAnalyze !== false"
          block
          theme="primary"
          :disabled="!selection"
          class="analyze-btn"
          @click="handleAnalyze"
        >
          分析颜色
        </Button>
        <el-button
          v-else-if="showAnalyze !== false"
          class="analyze-btn"
          type="primary"
          :disabled="!selection"
          @click="handleAnalyze"
        >
          分析颜色
        </el-button>
      </div>

      <p v-if="mode === 'select'" class="step-hint">单指拖拽框选拼豆图案区域</p>
      <p v-else-if="mode === 'adjust'" class="step-hint">对照网格线微调行列数，确保对齐</p>

      <div v-if="mode === 'select' && selection" class="reselect-hint">
        <Button
          v-if="variant === 'pixel'"
          size="small"
          variant="text"
          theme="primary"
          @click="selection = null; emit('selection-change', false)"
        >
          重新框选
        </Button>
        <el-button v-else size="small" text type="primary" @click="selection = null; emit('selection-change', false)">
          重新框选
        </el-button>
      </div>

      <div
        class="image-container"
        :class="{ interactive: canInteract }"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @touchstart.passive="onTouchStart"
        @touchmove="onTouchMove"
      >
        <img ref="imageRef" :src="imageUrl" alt="拼豆图纸" draggable="false" />
        <div
          v-if="displaySelection && displaySelection.width > 0"
          class="selection-box"
          :style="{
            left: displaySelection.x + 'px',
            top: displaySelection.y + 'px',
            width: displaySelection.width + 'px',
            height: displaySelection.height + 'px',
          }"
        >
          <svg
            v-if="showGrid"
            class="grid-overlay"
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
          </svg>
          <span v-if="showGrid && rows > 0 && cols > 0" class="grid-hint">{{ cols }} × {{ rows }}</span>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.image-selector {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.upload-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.upload-area :deep(.el-upload) {
  width: 100%;
}

.upload-area :deep(.el-upload-dragger) {
  width: 100%;
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.upload-content {
  text-align: center;
  color: #606266;
  padding: 12px;
}

.upload-title {
  margin: 16px 0 6px;
  font-size: 17px;
  font-weight: 600;
  color: #303133;
}

.upload-desc {
  margin: 0;
  font-size: 13px;
  color: #909399;
}

.image-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.grid-controls {
  padding: 0 0 12px;
  flex-shrink: 0;
}

.grid-control-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 10px;
}

.grid-control-row label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.grid-control-row label span {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}

.grid-control-row :deep(.el-input-number) {
  width: 100%;
}

.detect-btn {
  width: 100%;
}

.analyze-btn {
  width: 100%;
  margin-top: 8px;
}

.reselect-hint {
  text-align: center;
  margin-bottom: 8px;
}

.step-hint {
  margin: 0 0 10px;
  font-size: 13px;
  color: #909399;
  text-align: center;
  flex-shrink: 0;
}

.image-container {
  position: relative;
  flex: 1;
  overflow: auto;
  background: #f0f2f5;
  border-radius: 10px;
  user-select: none;
  min-height: 200px;
  -webkit-overflow-scrolling: touch;
}

.image-container.interactive {
  cursor: crosshair;
  touch-action: none;
}

.image-container img {
  display: block;
  max-width: 100%;
  height: auto;
}

.selection-box {
  position: absolute;
  border: 2px solid #409eff;
  background: rgba(64, 158, 255, 0.1);
  pointer-events: none;
  box-sizing: border-box;
  overflow: hidden;
}

.grid-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.85));
}

.grid-overlay line {
  stroke: rgba(255, 255, 255, 0.92);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
  shape-rendering: crispEdges;
}

.grid-hint {
  position: absolute;
  top: 4px;
  left: 4px;
  background: rgba(64, 158, 255, 0.92);
  color: #fff;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  z-index: 1;
}

/* ===== 像素风格（移动端） ===== */
.variant-pixel .upload-area {
  padding: 0;
}

.variant-pixel .pixel-upload {
  width: 100%;
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px 20px;
  text-align: center;
}

.variant-pixel .pixel-upload-icon {
  width: 48px;
  height: 48px;
  color: var(--px-primary);
}

.variant-pixel .grid-control-row label span {
  font-size: 11px;
  color: var(--px-text);
  font-weight: 700;
}

.variant-pixel .step-hint {
  color: var(--px-text-muted);
  font-size: 11px;
}

.variant-pixel .image-container {
  background: var(--px-bg);
  border: 3px solid var(--px-border);
  border-radius: 0;
  box-shadow: inset 3px 3px 0 0 rgba(45, 27, 46, 0.1);
}

.variant-pixel .selection-box {
  border: 2px solid var(--px-primary);
  background: rgba(79, 142, 247, 0.15);
}

.variant-pixel .grid-hint {
  background: var(--px-primary);
  border: 2px solid var(--px-border);
  border-radius: 0;
  font-size: 10px;
  box-shadow: 2px 2px 0 0 var(--px-shadow);
}
</style>
