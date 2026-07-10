<script setup lang="ts">
import BeadGridViewport from './BeadGridViewport.vue'
import ColorDrawer from './ColorDrawer.vue'
import type { BeadCell } from '../utils/imageAnalysis'

defineProps<{
  rows: number
  cols: number
  cells: BeadCell[]
  hiddenColors: Set<string>
  colorVisibility: Map<string, boolean>
}>()

defineEmits<{
  toggle: [tag: string, visible: boolean]
  toggleAll: [visible: boolean]
}>()
</script>

<template>
  <div class="mobile-result">
    <BeadGridViewport
      :rows="rows"
      :cols="cols"
      :cells="cells"
      :hidden-colors="hiddenColors"
      :cell-size="20"
    />
    <ColorDrawer
      :cells="cells"
      :color-visibility="colorVisibility"
      @toggle="(tag, visible) => $emit('toggle', tag, visible)"
      @toggle-all="(visible) => $emit('toggleAll', visible)"
    />
  </div>
</template>

<style scoped>
.mobile-result {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  gap: 8px;
  padding-bottom: 4px;
}
</style>
