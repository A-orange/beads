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
  /** 外层 CSS zoom，用于提高 canvas 背板分辨率 */
  zoomScale?: number
  /** 水平翻转色块，文字保持正向 */
  mirrorX?: boolean
}>()

const CELL_SIZE = computed(() => props.cellSize ?? 16)
const GUIDE_EVERY = 10
/** 浏览器 canvas 边长上限保守值，避免超大网格 + 高倍缩放 OOM */
const MAX_CANVAS_EDGE = 8192
const MAX_RENDER_SCALE = 8

const canvasRef = ref<HTMLCanvasElement | null>(null)

const gridSize = computed(() => {
  if (props.rows <= 0 || props.cols <= 0) return null
  return getBeadGridWorldSize(props.rows, props.cols, CELL_SIZE.value, { fourSideLabels: true })
})

/** 按缩放档位提高绘制精度，避免 pinch 过程中频繁改 canvas 尺寸 */
const renderBoost = computed(() => {
  const z = Math.max(1, props.zoomScale ?? 1)
  const steps = [1, 1.5, 2, 3, 4, 6, 8]
  for (let i = steps.length - 1; i >= 0; i--) {
    if (z >= steps[i]!) return steps[i]!
  }
  return 1
})

let drawRaf = 0

function scheduleDraw() {
  if (drawRaf) return
  drawRaf = requestAnimationFrame(() => {
    drawRaf = 0
    drawFrame()
  })
}

function resolveDpr(width: number, height: number) {
  const baseDpr = Math.min(window.devicePixelRatio || 1, 2)
  const boost = Math.min(renderBoost.value, MAX_RENDER_SCALE)
  const maxByEdge = Math.min(MAX_CANVAS_EDGE / width, MAX_CANVAS_EDGE / height)
  return Math.max(1, Math.min(baseDpr * boost, maxByEdge))
}

function drawFrame() {
  const canvas = canvasRef.value
  const size = gridSize.value
  if (!canvas || !size || !props.cells.length) return

  const { width, height } = size
  if (width <= 0 || height <= 0) return

  const dpr = resolveDpr(width, height)
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
    mirrorX: props.mirrorX === true,
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
      props.mirrorX,
      CELL_SIZE.value,
      renderBoost.value,
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
