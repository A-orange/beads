<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import PatternSheetViewport from './PatternSheetViewport.vue'
import ColorLegendGrid from './ColorLegendGrid.vue'
import IslandDecorations from './IslandDecorations.vue'
import { usePinchPan } from '../composables/usePinchPan'
import { getBeadGridWorldSize } from '../utils/beadGridCanvas'
import { SHEET_GRID_INSET } from '../constants/sheetLayout'
import { exportPatternSheet } from '../utils/exportPatternSheet'
import { IslandMessage } from '../utils/islandMessage'
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

const documentWidth = computed(() =>
  Math.max(320, gridCanvasWidth.value + SHEET_GRID_INSET * 2),
)

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

const lotteryHeight = computed(() => {
  const cols = Math.max(1, Math.floor((documentWidth.value - 48) / 94))
  const rows = Math.max(1, Math.ceil(Math.max(colorUsages.value.length, 1) / cols))
  const contentH = rows * 28 - 6
  // 与虚线框上下留白（padding 上下各 20）
  return 20 + contentH + 20
})

const {
  scale,
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
  lotteryHeight.value,
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
    IslandMessage.success('图纸已导出')
  } catch (e) {
    IslandMessage.error('导出失败：' + (e instanceof Error ? e.message : '未知错误'))
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
      class="sheet-envelope"
      data-sheet-export
      :style="{
        width: `${documentWidth}px`,
        '--lottery-h': `${lotteryHeight}px`,
        ...transformStyle,
      }"
    >
      <div class="sheet-document">
        <IslandDecorations sheet lottery-offset />

        <header class="sheet-header">
          <h2 class="sheet-title">{{ headerText }}</h2>
          <div class="sheet-banner" aria-hidden="true">
            <span class="sheet-banner-line" />
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path
                d="M12 2 L14.5 9 L22 9.5 L16 14.5 L18 22 L12 17.5 L6 22 L8 14.5 L2 9.5 L9.5 9 Z"
                fill="#f7cd67"
                stroke="#725d42"
                stroke-width="1.4"
                stroke-linejoin="round"
              />
            </svg>
            <span class="sheet-banner-line" />
          </div>
        </header>

        <div class="sheet-grid-frame">
          <div class="sheet-grid-stack">
            <PatternSheetViewport
              :rows="rows"
              :cols="cols"
              :cells="cells"
              :hidden-colors="hiddenColors"
              :background-colors="backgroundColors"
              :cell-size="CELL_SIZE"
              :show-grid="showGrid"
              :show-cell-labels="showCellLabels"
              :zoom-scale="scale"
            />
            <div class="sheet-grid-mirror" aria-hidden="true">
              <PatternSheetViewport
                mirror-x
                :rows="rows"
                :cols="cols"
                :cells="cells"
                :hidden-colors="hiddenColors"
                :background-colors="backgroundColors"
                :cell-size="CELL_SIZE"
                :show-grid="showGrid"
                :show-cell-labels="showCellLabels"
                :zoom-scale="scale"
              />
            </div>
          </div>
        </div>

        <section class="sheet-lottery" :style="{ height: `${lotteryHeight}px` }">
          <span class="sheet-tear-hint">
            <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true">
              <g fill="none" stroke="#725d42" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="6" cy="6" r="2.4" />
                <circle cx="6" cy="18" r="2.4" />
                <path d="M8 7.5 L21 17 M8 16.5 L21 7" />
              </g>
            </svg>
            <span>沿虚线剪开</span>
            <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true">
              <g fill="none" stroke="#725d42" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="6" cy="6" r="2.4" />
                <circle cx="6" cy="18" r="2.4" />
                <path d="M8 7.5 L21 17 M8 16.5 L21 7" />
              </g>
            </svg>
          </span>
          <ColorLegendGrid
            embedded
            lottery
            :cells="cells"
            :hidden-colors="hiddenColors"
            :background-colors="backgroundColors"
            @toggle="(tag, visible) => emit('toggle', tag, visible)"
          />
        </section>
      </div>

      <!-- 裁剪半圆描边：放在 mask 外层，避免被冲孔裁掉 -->
      <span class="sheet-notch sheet-notch--left" aria-hidden="true" />
      <span class="sheet-notch sheet-notch--right" aria-hidden="true" />
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
  background: transparent;
}

.sheet-envelope {
  --lottery-h: 160px;
  --sheet-border: rgba(114, 93, 66, 0.12);
  --sheet-notch-r: 14px;
  position: relative;
  filter: drop-shadow(0 10px 24px rgba(61, 52, 40, 0.18));
}

.sheet-document {
  position: relative;
  display: flex;
  flex-direction: column;
  padding-bottom: var(--lottery-h);
  overflow: visible;
  border-radius: 16px;
  border: 2px solid var(--sheet-border);
  background:
    radial-gradient(circle at 20% 10%, rgba(248, 166, 178, 0.18), transparent 40%),
    radial-gradient(circle at 80% 50%, rgba(138, 198, 138, 0.16), transparent 42%),
    rgb(247, 243, 223);
  -webkit-mask-image: radial-gradient(
      circle var(--sheet-notch-r) at 0% calc(100% - var(--lottery-h)),
      transparent 98%,
      #000 100%
    ),
    radial-gradient(
      circle var(--sheet-notch-r) at 100% calc(100% - var(--lottery-h)),
      transparent 98%,
      #000 100%
    ),
    linear-gradient(#000, #000);
  mask-image: radial-gradient(
      circle var(--sheet-notch-r) at 0% calc(100% - var(--lottery-h)),
      transparent 98%,
      #000 100%
    ),
    radial-gradient(
      circle var(--sheet-notch-r) at 100% calc(100% - var(--lottery-h)),
      transparent 98%,
      #000 100%
    ),
    linear-gradient(#000, #000);
  -webkit-mask-composite: destination-out;
  mask-composite: exclude;
}

.sheet-document::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.45;
  border-radius: inherit;
  background-image: radial-gradient(circle, rgba(114, 93, 66, 0.14) 1px, transparent 1.5px);
  background-size: 14px 14px;
}

.sheet-document::after {
  content: '';
  position: absolute;
  inset: 10px;
  bottom: calc(var(--lottery-h) + 6px);
  z-index: 0;
  pointer-events: none;
  border: 1.5px dashed rgba(114, 93, 66, 0.35);
  border-radius: 22px 20px 24px 22px / 20px 24px 22px 20px;
}

.sheet-notch {
  position: absolute;
  top: calc(100% - var(--lottery-h) - var(--sheet-notch-r));
  width: var(--sheet-notch-r);
  height: calc(var(--sheet-notch-r) * 2);
  overflow: hidden;
  z-index: 6;
  pointer-events: none;
}

.sheet-notch::after {
  content: '';
  position: absolute;
  top: 0;
  width: calc(var(--sheet-notch-r) * 2);
  height: calc(var(--sheet-notch-r) * 2);
  box-sizing: border-box;
  border-radius: 50%;
  border: 2px solid var(--sheet-border);
  background: transparent;
}

.sheet-notch--left {
  left: 0;
}

.sheet-notch--left::after {
  left: calc(var(--sheet-notch-r) * -1);
}

.sheet-notch--right {
  right: 0;
}

.sheet-notch--right::after {
  right: calc(var(--sheet-notch-r) * -1);
  left: auto;
}

.sheet-header,
.sheet-grid-frame,
.sheet-lottery {
  position: relative;
  z-index: 1;
}

.sheet-header {
  flex-shrink: 0;
  padding: 20px 20px 8px;
  text-align: center;
}

.sheet-title {
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.45;
  letter-spacing: 0.02em;
  word-break: break-word;
  color: #794f27;
}

.sheet-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
}

.sheet-banner-line {
  width: 64px;
  height: 2px;
  background: linear-gradient(to right, transparent, #725d42, transparent);
}

.sheet-grid-frame {
  flex-shrink: 0;
  padding: 8px 16px 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.sheet-grid-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.sheet-grid-mirror {
  pointer-events: none;
  user-select: none;
}

.sheet-lottery {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 20px 20px;
  box-sizing: border-box;
  /* 仅保留顶部撕痕阴影，边框改用真实 border，避免圆角缺色 */
  box-shadow: inset 0 4px 6px -3px rgba(61, 52, 40, 0.18);
}

/* 与上方同色的实线外边框 */
.sheet-lottery::before {
  content: '';
  position: absolute;
  inset: 8px;
  z-index: 0;
  pointer-events: none;
  border: 2px solid rgba(114, 93, 66, 0.12);
  border-radius: 20px 18px 22px 20px / 18px 22px 20px 18px;
}

.sheet-lottery::after {
  content: '';
  position: absolute;
  inset: 10px;
  z-index: 0;
  pointer-events: none;
  border: 1.5px dashed rgba(114, 93, 66, 0.35);
  border-radius: 22px 20px 24px 22px / 20px 24px 22px 20px;
}

.sheet-lottery :deep(.color-legend) {
  position: relative;
  z-index: 1;
}

.sheet-tear-hint {
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 12px;
  background: #f7f3df;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1.2px rgba(114, 93, 66, 0.3);
  font-size: 10px;
  letter-spacing: 3px;
  font-weight: 700;
  color: #9a835a;
  white-space: nowrap;
  line-height: 1;
}

.sheet-tear-hint svg {
  flex-shrink: 0;
  display: block;
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
