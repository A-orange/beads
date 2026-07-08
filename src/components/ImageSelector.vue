<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
import type { UploadFile } from 'element-plus'
import type { SelectionRect } from '../utils/imageAnalysis'

const props = defineProps<{
  rows: number
  cols: number
  detecting?: boolean
}>()

const emit = defineEmits<{
  analyze: [selection: SelectionRect]
  detect: [selection: SelectionRect]
  'update:rows': [value: number]
  'update:cols': [value: number]
}>()

const imageUrl = ref<string | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
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
  () => Boolean(displaySelection.value && props.rows > 0 && props.cols > 0),
)

const verticalLines = computed(() => {
  if (!showGrid.value || !props.cols) return []
  return Array.from({ length: props.cols - 1 }, (_, i) => ((i + 1) / props.cols) * 100)
})

const horizontalLines = computed(() => {
  if (!showGrid.value || !props.rows) return []
  return Array.from({ length: props.rows - 1 }, (_, i) => ((i + 1) / props.rows) * 100)
})

function handleFileChange(file: File) {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = URL.createObjectURL(file)
  selection.value = null
  emit('update:rows', 0)
  emit('update:cols', 0)
}

function onUploadChange(uploadFile: UploadFile) {
  if (uploadFile.raw) handleFileChange(uploadFile.raw)
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files[0]
  if (file?.type.startsWith('image/')) handleFileChange(file)
}

function getRelativePos(event: MouseEvent) {
  const img = imageRef.value
  if (!img) return { x: 0, y: 0 }

  const rect = img.getBoundingClientRect()
  return {
    x: Math.max(0, Math.min(event.clientX - rect.left, rect.width)),
    y: Math.max(0, Math.min(event.clientY - rect.top, rect.height)),
  }
}

function onMouseDown(event: MouseEvent) {
  if (!imageUrl.value) return
  isDragging.value = true
  const pos = getRelativePos(event)
  dragStart.value = pos
  currentDrag.value = pos
}

function onMouseMove(event: MouseEvent) {
  if (!isDragging.value) return
  currentDrag.value = getRelativePos(event)
}

function onMouseUp() {
  if (!isDragging.value) return
  isDragging.value = false

  const x = Math.min(dragStart.value.x, currentDrag.value.x)
  const y = Math.min(dragStart.value.y, currentDrag.value.y)
  const width = Math.abs(currentDrag.value.x - dragStart.value.x)
  const height = Math.abs(currentDrag.value.y - dragStart.value.y)

  if (width > 10 && height > 10) {
    selection.value = { x, y, width, height }
    const natural = toNaturalSelection()
    if (natural) emit('detect', natural)
  }
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

onMounted(() => {
  window.addEventListener('mouseup', onMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('mouseup', onMouseUp)
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
})

defineExpose({ imageRef, getSelection: toNaturalSelection })
</script>

<template>
  <div class="image-selector">
    <div
      v-if="!imageUrl"
      class="upload-area"
      @dragover.prevent
      @drop="onDrop"
    >
      <el-upload
        drag
        :auto-upload="false"
        :show-file-list="false"
        accept="image/*"
        @change="onUploadChange"
      >
        <div class="upload-content">
          <el-icon :size="48" color="#409eff"><UploadFilled /></el-icon>
          <p>拖拽或点击上传拼豆图纸</p>
        </div>
      </el-upload>
    </div>

    <div v-else class="image-workspace">
      <div class="toolbar">
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          accept="image/*"
          @change="onUploadChange"
        >
          <el-button size="small">重新上传</el-button>
        </el-upload>

        <template v-if="selection">
          <el-divider direction="vertical" />
          <span class="field-label">列</span>
          <el-input-number
            :model-value="cols"
            :min="1"
            :max="300"
            size="small"
            controls-position="right"
            @update:model-value="emit('update:cols', $event ?? 0)"
          />
          <span class="field-label">行</span>
          <el-input-number
            :model-value="rows"
            :min="1"
            :max="300"
            size="small"
            controls-position="right"
            @update:model-value="emit('update:rows', $event ?? 0)"
          />
          <el-button size="small" :loading="detecting" @click="handleDetect">
            自动识别
          </el-button>
        </template>

        <span class="hint">
          {{ selection ? '调整行列数对齐网格线后分析' : '拖拽框选拼豆图案区域' }}
        </span>

        <el-button
          type="primary"
          size="small"
          :disabled="!selection"
          @click="handleAnalyze"
        >
          分析颜色
        </el-button>
      </div>

      <div
        ref="containerRef"
        class="image-container"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
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
          <span v-if="rows > 0 && cols > 0" class="grid-hint">{{ cols }} × {{ rows }}</span>
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
}

.upload-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.upload-area :deep(.el-upload) {
  width: 100%;
}

.upload-area :deep(.el-upload-dragger) {
  width: 100%;
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-content {
  text-align: center;
  color: #606266;
}

.upload-content p {
  margin-top: 12px;
  font-size: 14px;
}

.image-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0 12px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.field-label {
  font-size: 12px;
  color: #606266;
}

.toolbar :deep(.el-input-number) {
  width: 88px;
}

.hint {
  flex: 1;
  font-size: 12px;
  color: #909399;
  min-width: 120px;
}

.image-container {
  position: relative;
  flex: 1;
  overflow: auto;
  background: #f0f2f5;
  border-radius: 8px;
  cursor: crosshair;
  user-select: none;
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
</style>
