<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import PatternSheetViewport from './PatternSheetViewport.vue'
import ColorLegendGrid from './ColorLegendGrid.vue'
import { usePinchPan } from '../composables/usePinchPan'
import { getBeadGridWorldSize } from '../utils/beadGridCanvas'
import { SHEET_GRID_INSET } from '../constants/sheetLayout'
import { exportPatternSheet } from '../utils/exportPatternSheet'
import { PixelMessage } from '../utils/pixelMessage'
import { countsAsBead } from '../utils/beadColorRoles'
import type { BeadCell } from '../utils/imageAnalysis'
import type { ColorUsage } from '../types'

const props = defineProps<{
  title: string
  rows: number
  cols: number
  cells: BeadCell[]
  hiddenColors: Set<string>
  backgroundColors: Set<string>
  cellSize?: number
  /** 嵌入 page-shell 时使用透明背景 */
  framed?: boolean
}>()

const showGrid = defineModel<boolean>('showGrid', { default: true })
const showCellLabels = defineModel<boolean>('showCellLabels', { default: true })

const emit = defineEmits<{
  toggle: [tag: string, visible: boolean]
}>()

const CELL_SIZE = computed(() => props.cellSize ?? 16)

const viewportRef = ref<HTMLElement | null>(null)
const documentRef = ref<HTMLElement | null>(null)
const documentSize = ref<{ w: number; h: number } | null>(null)

const colorCount = computed(() => {
  const tags = new Set<string>()
  for (const cell of props.cells) {
    if (countsAsBead(cell.color.tag, props.hiddenColors, props.backgroundColors)) {
      tags.add(cell.color.tag)
    }
  }
  return tags.size
})

const beadCount = computed(() =>
  props.cells.filter((c) =>
    countsAsBead(c.color.tag, props.hiddenColors, props.backgroundColors),
  ).length,
)

const headerText = computed(
  () => `${props.title} [${props.cols}×${props.rows} / ${colorCount.value}色 / 共${beadCount.value}颗]`,
)

const gridCanvasWidth = computed(() => {
  if (props.rows <= 0 || props.cols <= 0) return 320
  return getBeadGridWorldSize(props.rows, props.cols, CELL_SIZE.value, { fourSideLabels: true }).width
})

const documentWidth = computed(() => gridCanvasWidth.value + SHEET_GRID_INSET * 2)

const colorUsages = computed<ColorUsage[]>(() => {
  const map = new Map<string, ColorUsage>()
  for (const cell of props.cells) {
    const existing = map.get(cell.color.tag)
    if (existing) existing.count++
    else {
      map.set(cell.color.tag, {
        color: cell.color,
        count: 1,
        visible: !props.hiddenColors.has(cell.color.tag),
      })
    }
  }
  return Array.from(map.values())
    .filter((item) => !props.backgroundColors.has(item.color.tag))
    .map((item) => ({
      ...item,
      visible: !props.hiddenColors.has(item.color.tag),
    }))
    .sort((a, b) => b.count - a.count)
})

const {
  transformStyle,
  fitToView,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onWheel,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  bindFitWhenReady,
} = usePinchPan(viewportRef, documentRef, { contentSize: documentSize })

bindFitWhenReady(() => [
  props.rows,
  props.cols,
  props.cells.length,
  colorCount.value,
  gridCanvasWidth.value,
  showGrid.value,
  showCellLabels.value,
])

let documentObserver: ResizeObserver | null = null

function measureDocument() {
  const el = documentRef.value
  if (!el) return
  const w = el.offsetWidth
  const h = el.offsetHeight
  if (w > 0 && h > 0) documentSize.value = { w, h }
}

function toggleGrid() {
  showGrid.value = !showGrid.value
}

function toggleCellLabels() {
  showCellLabels.value = !showCellLabels.value
}

async function exportSheet() {
  try {
    await exportPatternSheet({
      title: headerText.value,
      rows: props.rows,
      cols: props.cols,
      cells: props.cells,
      hiddenColors: props.hiddenColors,
      backgroundColors: props.backgroundColors,
      colorUsages: colorUsages.value,
      cellSize: CELL_SIZE.value,
      showGrid: showGrid.value,
      showCellLabels: showCellLabels.value,
    })
    PixelMessage.success('图纸已导出')
  } catch (e) {
    PixelMessage.error('导出失败：' + (e instanceof Error ? e.message : '未知错误'))
  }
}

watch(
  () => [props.rows, props.cols, props.cells, props.hiddenColors, props.backgroundColors, colorCount.value] as const,
  () => requestAnimationFrame(measureDocument),
  { deep: true },
)

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  if (documentRef.value) {
    documentObserver = new ResizeObserver(() => {
      measureDocument()
    })
    documentObserver.observe(documentRef.value)
  }
  requestAnimationFrame(() => {
    measureDocument()
    fitToView()
  })
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  documentObserver?.disconnect()
})

defineExpose({
  sheetDocumentRef: documentRef,
  toggleGrid,
  toggleCellLabels,
  exportSheet,
  showGrid,
  showCellLabels,
})
</script>

<template>
  <div
    ref="viewportRef"
    class="sheet-viewport"
    :class="{ framed }"
    @touchstart.passive="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchEnd"
    @wheel.prevent="onWheel"
    @mousedown="onMouseDown"
  >
    <div
      ref="documentRef"
      class="sheet-document"
      data-sheet-export
      :style="{ width: `${documentWidth}px`, ...transformStyle }"
    >
      <header class="sheet-header">
        <h2 class="sheet-title">{{ headerText }}</h2>
      </header>

      <div class="sheet-grid-frame">
        <PatternSheetViewport
          :rows="rows"
          :cols="cols"
          :cells="cells"
          :hidden-colors="hiddenColors"
          :background-colors="backgroundColors"
          :cell-size="CELL_SIZE"
          :show-grid="showGrid"
          :show-cell-labels="showCellLabels"
        />
      </div>

      <ColorLegendGrid
        embedded
        :cells="cells"
        :hidden-colors="hiddenColors"
        :background-colors="backgroundColors"
        @toggle="(tag, visible) => emit('toggle', tag, visible)"
      />
    </div>

    <p class="viewport-hint">拖动平移 · 滚轮/双指缩放</p>
  </div>
</template>

<style scoped>
.sheet-viewport {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  touch-action: none;
  position: relative;
  background: var(--sd-bg-alt);
}

.sheet-viewport.framed {
  background: var(--sd-bg);
}

.sheet-document {
  display: flex;
  flex-direction: column;
  background: var(--sd-sheet-doc-bg);
  border: 2px solid #008575;
  border-radius: 8px;
  overflow: hidden;
  box-shadow:
    0 4px 14px rgba(0, 136, 117, 0.22),
    0 1px 0 rgba(255, 255, 255, 0.12) inset;
}

.sheet-header {
  flex-shrink: 0;
  padding: 10px 12px;
  text-align: center;
  background: transparent;
  border-bottom: 1px solid rgba(255, 255, 255, 0.22);
}

.sheet-title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  word-break: break-word;
  color: var(--sd-primary-dark);
  font-family: var(--sd-font-display);
  text-shadow: 0 1px 0 rgba(0, 133, 117, 0.35);
}

.sheet-grid-frame {
  flex-shrink: 0;
  padding: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
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
