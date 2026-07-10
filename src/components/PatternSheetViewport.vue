<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { BeadCell } from '../utils/imageAnalysis'
import { drawBeadGrid, getBeadGridWorldSize } from '../utils/beadGridCanvas'
import { SHEET_GRID_BG } from '../constants/sheetLayout'

const props = defineProps<{
  rows: number
  cols: number
  cells: BeadCell[]
  hiddenColors: Set<string>
  backgroundColors: Set<string>
  cellSize?: number
  showGrid?: boolean
  showCellLabels?: boolean
}>()

const CELL_SIZE = computed(() => props.cellSize ?? 16)
const GUIDE_EVERY = 10

const canvasRef = ref<HTMLCanvasElement | null>(null)

const gridSize = computed(() => {
  if (props.rows <= 0 || props.cols <= 0) return null
  return getBeadGridWorldSize(props.rows, props.cols, CELL_SIZE.value, { fourSideLabels: true })
})

let drawRaf = 0

function scheduleDraw() {
  if (drawRaf) return
  drawRaf = requestAnimationFrame(() => {
    drawRaf = 0
    drawFrame()
  })
}

function drawFrame() {
  const canvas = canvasRef.value
  const size = gridSize.value
  if (!canvas || !size || !props.cells.length) return

  const { width, height } = size
  if (width <= 0 || height <= 0) return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  drawBeadGrid(ctx, {
    rows: props.rows,
    cols: props.cols,
    cells: props.cells,
    hiddenColors: props.hiddenColors,
    backgroundColors: props.backgroundColors,
    cellSize: CELL_SIZE.value,
    viewportW: width,
    viewportH: height,
    translateX: 0,
    translateY: 0,
    scale: 1,
    fourSideLabels: true,
    guideLineEvery: props.showGrid !== false ? GUIDE_EVERY : 0,
    showGrid: props.showGrid !== false,
    showCellLabels: props.showCellLabels !== false,
    backgroundColor: SHEET_GRID_BG,
  })
}

watch(
  () =>
    [
      props.rows,
      props.cols,
      props.cells,
      props.hiddenColors,
      props.backgroundColors,
      props.showGrid,
      props.showCellLabels,
      CELL_SIZE.value,
    ] as const,
  scheduleDraw,
  { deep: true },
)

onMounted(() => scheduleDraw())

onUnmounted(() => {
  if (drawRaf) cancelAnimationFrame(drawRaf)
})

defineExpose({ canvasRef })
</script>

<template>
  <div v-if="gridSize" class="sheet-grid-area">
    <canvas v-if="cells.length" ref="canvasRef" class="sheet-grid-canvas" />
    <p v-else class="sheet-empty sd-body sd-text-muted">暂无网格数据</p>
  </div>
</template>

<style scoped>
.sheet-grid-area {
  background: var(--sd-sheet-grid-bg);
  line-height: 0;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 136, 117, 0.15);
}

.sheet-grid-canvas {
  display: block;
  vertical-align: top;
}

.sheet-empty {
  margin: 0;
  padding: 24px 16px;
  text-align: center;
  font-size: 13px;
  line-height: 1.4;
}
</style>
