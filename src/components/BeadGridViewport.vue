<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Button } from '@pixelium/web-vue/es'
import BeadGrid from './BeadGrid.vue'
import type { BeadCell } from '../utils/imageAnalysis'
import { usePinchPan } from '../composables/usePinchPan'

const props = defineProps<{
  rows: number
  cols: number
  cells: BeadCell[]
  hiddenColors: Set<string>
  cellSize?: number
}>()

const containerRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)

const {
  transformStyle,
  fitToView,
  resetView,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  bindFitWhenReady,
} = usePinchPan(containerRef, contentRef)

bindFitWhenReady(() => [props.rows, props.cols, props.cells.length, props.cellSize])

onMounted(() => {
  requestAnimationFrame(() => fitToView())
})
</script>

<template>
  <div class="bead-viewport sd-inset">
    <div class="viewport-toolbar">
      <span class="viewport-meta sd-body sd-text-muted">
        {{ rows }}×{{ cols }} · {{ cells.length }} 颗
      </span>
      <div class="viewport-actions">
        <Button size="small" variant="outline" theme="notice" @click="fitToView()">
          全览
        </Button>
        <Button size="small" variant="outline" theme="info" @click="resetView()">
          重置
        </Button>
      </div>
    </div>

    <div
      ref="containerRef"
      class="viewport-stage"
      @touchstart.passive="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <div ref="contentRef" class="viewport-content" :style="transformStyle">
        <BeadGrid
          :rows="rows"
          :cols="cols"
          :cells="cells"
          :hidden-colors="hiddenColors"
          :cell-size="cellSize ?? 20"
          :show-info="false"
          embedded
        />
      </div>
    </div>

    <p class="viewport-hint sd-body sd-text-muted">双指缩放 · 单指拖动</p>
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

.viewport-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  flex-shrink: 0;
  border-bottom: 2px solid var(--sd-border-light);
  background: var(--sd-surface);
}

.viewport-meta {
  font-weight: 600;
}

.viewport-actions {
  display: flex;
  gap: 6px;
}

.viewport-stage {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  touch-action: none;
  position: relative;
  background:
    linear-gradient(90deg, rgba(139, 105, 20, 0.06) 1px, transparent 1px),
    linear-gradient(rgba(139, 105, 20, 0.06) 1px, transparent 1px);
  background-size: 20px 20px;
}

.viewport-content {
  position: absolute;
  top: 0;
  left: 0;
}

.viewport-hint {
  flex-shrink: 0;
  margin: 0;
  padding: 6px 10px;
  text-align: center;
  font-size: 11px;
  background: var(--sd-surface);
  border-top: 2px solid var(--sd-border-light);
}
</style>
