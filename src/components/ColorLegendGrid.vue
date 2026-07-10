<script setup lang="ts">
import { computed } from 'vue'
import { getContrastTextColor } from '../utils/colorMatch'
import SdIcon from './SdIcon.vue'
import type { BeadCell } from '../utils/imageAnalysis'
import type { ColorUsage } from '../types'

const props = defineProps<{
  cells: BeadCell[]
  hiddenColors?: Set<string>
  backgroundColors?: Set<string>
  /** 嵌入图纸文档时展示全部色块，不单独滚动 */
  embedded?: boolean
}>()

const emit = defineEmits<{
  toggle: [tag: string, visible: boolean]
}>()

const colorUsages = computed<ColorUsage[]>(() => {
  const map = new Map<string, ColorUsage>()

  for (const cell of props.cells) {
    const existing = map.get(cell.color.tag)
    if (existing) {
      existing.count++
    } else {
      map.set(cell.color.tag, {
        color: cell.color,
        count: 1,
        visible: true,
      })
    }
  }

  return Array.from(map.values())
    .filter((item) => !props.backgroundColors?.has(item.color.tag))
    .map((item) => ({
      ...item,
      visible: !props.hiddenColors?.has(item.color.tag),
    }))
    .sort((a, b) => b.count - a.count)
})

function chipStyle(item: ColorUsage) {
  const bg = item.color.hex
  return {
    backgroundColor: bg,
    color: getContrastTextColor(bg),
  }
}

function onChipClick(item: ColorUsage) {
  emit('toggle', item.color.tag, !item.visible)
}
</script>

<template>
  <section class="color-legend" :class="{ embedded }">
    <div class="legend-grid">
      <button
        v-for="item in colorUsages"
        :key="item.color.tag"
        type="button"
        class="legend-chip"
        :class="{ off: !item.visible }"
        :style="chipStyle(item)"
        @click="onChipClick(item)"
      >
        <span class="chip-code">{{ item.color.tag }}</span>
        <span class="chip-count">{{ item.count }}</span>
        <SdIcon :name="item.visible ? 'check' : 'eye-off'" :size="10" class="chip-state-icon" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.color-legend {
  flex-shrink: 0;
  margin: 0;
  padding: 8px 10px;
  background: #fff;
  border-top: 1px solid var(--sd-border-light);
}

.color-legend.embedded {
  max-height: none;
  overflow: visible;
  padding: 4px 10px 12px;
  background: transparent;
  border: none;
}

.legend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 6px;
}

.legend-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  min-width: 0;
  min-height: 24px;
  padding: 4px 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  box-shadow: 1px 1px 0 0 rgba(92, 64, 51, 0.1);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: opacity 0.15s, box-shadow 0.15s;
}

.legend-chip:active {
  transform: translate(1px, 1px);
  box-shadow: none;
}

.legend-chip.off {
  opacity: 0.42;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
}

.chip-code {
  font-size: 10px;
  font-weight: 700;
  font-family: var(--sd-font-display);
}

.chip-count {
  font-size: 10px;
  font-weight: 600;
  font-family: var(--sd-font-body);
  flex-shrink: 0;
}

.chip-state-icon {
  opacity: 0.85;
  flex-shrink: 0;
}
</style>
