<script setup lang="ts">
import { ref } from 'vue'
import BeadGridViewport from './BeadGridViewport.vue'
import ColorDrawer from './ColorDrawer.vue'
import type { BeadColor } from '../data/beadColor'
import type { BeadCell } from '../utils/imageAnalysis'

defineProps<{
  rows: number
  cols: number
  cells: BeadCell[]
  hiddenColors: Set<string>
  backgroundColors: Set<string>
  colorVisibility: Map<string, boolean>
}>()

defineEmits<{
  toggle: [tag: string, visible: boolean]
  toggleBackground: [tag: string, isBackground: boolean]
  replaceColor: [fromTag: string, color: BeadColor]
  replaceCells: [keys: Array<{ row: number; col: number }>, color: BeadColor]
  paletteChange: [paletteId: string]
}>()

const drawerExpanded = ref(false)
</script>

<template>
  <div class="mobile-result" :class="{ 'drawer-expanded': drawerExpanded }">
    <BeadGridViewport
      :rows="rows"
      :cols="cols"
      :cells="cells"
      :hidden-colors="hiddenColors"
      :background-colors="backgroundColors"
      :cell-size="20"
      @replace-cells="(keys, color) => $emit('replaceCells', keys, color)"
    />
    <ColorDrawer
      v-model:expanded="drawerExpanded"
      :cells="cells"
      :color-visibility="colorVisibility"
      :hidden-colors="hiddenColors"
      :background-colors="backgroundColors"
      @toggle="(tag, visible) => $emit('toggle', tag, visible)"
      @toggle-background="(tag, isBg) => $emit('toggleBackground', tag, isBg)"
      @replace-color="(fromTag, color) => $emit('replaceColor', fromTag, color)"
      @palette-change="(id) => $emit('paletteChange', id)"
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
}

.mobile-result.drawer-expanded :deep(.bead-viewport) {
  flex: 0 0 auto;
}

.mobile-result.drawer-expanded :deep(.viewport-stage) {
  display: none;
}

.mobile-result.drawer-expanded :deep(.color-drawer) {
  flex: 1;
  min-height: 0;
  margin-top: 0;
}
</style>
