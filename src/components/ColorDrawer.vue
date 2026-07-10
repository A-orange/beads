<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Checkbox, Tag } from '@pixelium/web-vue/es'
import type { BeadCell } from '../utils/imageAnalysis'
import type { ColorUsage } from '../types'

const props = defineProps<{
  cells: BeadCell[]
  colorVisibility: Map<string, boolean>
}>()

const emit = defineEmits<{
  toggle: [tag: string, visible: boolean]
  toggleAll: [visible: boolean]
}>()

const expanded = ref(false)

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
        visible: props.colorVisibility.get(cell.color.tag) ?? true,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const seriesA = a.color.tag.charAt(0)
    const seriesB = b.color.tag.charAt(0)
    if (seriesA !== seriesB) return seriesA.localeCompare(seriesB)
    return parseInt(a.color.tag.slice(1), 10) - parseInt(b.color.tag.slice(1), 10)
  })
})

const visibleBeads = computed(() =>
  props.cells.filter((c) => props.colorVisibility.get(c.color.tag) !== false).length,
)

function toggleExpanded() {
  expanded.value = !expanded.value
}

function onChipClick(tag: string) {
  const visible = props.colorVisibility.get(tag) ?? true
  emit('toggle', tag, !visible)
}
</script>

<template>
  <div class="color-drawer sd-panel-wood" :class="{ expanded }">
    <button type="button" class="drawer-handle" @click="toggleExpanded">
      <span class="handle-bar" />
      <span class="handle-title">色卡清单</span>
      <Tag theme="notice" size="small">{{ colorUsages.length }} 色</Tag>
      <span class="handle-meta sd-body">{{ visibleBeads }}/{{ cells.length }} 颗</span>
      <span class="handle-chevron">{{ expanded ? '▼' : '▲' }}</span>
    </button>

    <div class="drawer-toolbar">
      <Button size="small" variant="text" theme="primary" @click="emit('toggleAll', true)">
        全选
      </Button>
      <Button size="small" variant="text" theme="info" @click="emit('toggleAll', false)">
        全不选
      </Button>
    </div>

    <div class="drawer-peek">
      <button
        v-for="item in colorUsages"
        :key="'peek-' + item.color.tag"
        type="button"
        class="color-chip"
        :class="{ off: !item.visible }"
        :title="`${item.color.tag} × ${item.count}`"
        @click="onChipClick(item.color.tag)"
      >
        <span class="chip-swatch" :style="{ backgroundColor: item.color.hex }" />
        <span class="chip-tag">{{ item.color.tag }}</span>
        <span class="chip-count">{{ item.count }}</span>
      </button>
    </div>

    <div v-if="expanded" class="drawer-body">
      <label
        v-for="item in colorUsages"
        :key="'row-' + item.color.tag"
        class="color-row sd-panel"
        :class="{ off: !item.visible }"
      >
        <Checkbox
          variant="retro"
          :model-value="item.visible"
          @update:model-value="(val: boolean) => emit('toggle', item.color.tag, val)"
        />
        <span class="row-swatch sd-inset" :style="{ backgroundColor: item.color.hex }" />
        <span class="row-tag">{{ item.color.tag }}</span>
        <span class="row-hex sd-text-muted">{{ item.color.hex }}</span>
        <Tag theme="primary" size="small" variant="plain">{{ item.count }}</Tag>
      </label>
    </div>
  </div>
</template>

<style scoped>
.color-drawer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: 0 12px;
  transition: max-height 0.25s ease;
  max-height: var(--drawer-collapsed);
}

.color-drawer.expanded {
  max-height: var(--drawer-expanded);
}

.drawer-handle {
  display: grid;
  grid-template-columns: auto 1fr auto auto auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px 4px;
  border: none;
  background: transparent;
  color: var(--sd-text);
  cursor: pointer;
  font-family: inherit;
}

.handle-bar {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 4px;
  background: var(--sd-wood);
  border-radius: 2px;
  opacity: 0.55;
}

.color-drawer {
  position: relative;
}

.handle-title {
  font-size: 12px;
  font-weight: 700;
}

.handle-meta {
  font-size: 11px;
  color: var(--sd-text-muted);
}

.handle-chevron {
  font-size: 10px;
  color: var(--sd-text-muted);
}

.drawer-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  padding: 0 8px 6px;
}

.drawer-peek {
  display: flex;
  gap: 8px;
  padding: 0 10px 10px;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.drawer-peek::-webkit-scrollbar {
  display: none;
}

.color-chip {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 52px;
  padding: 6px 4px;
  border: 2px solid var(--sd-border);
  border-radius: 4px;
  background: var(--sd-surface);
  box-shadow: 2px 2px 0 0 var(--sd-shadow);
  cursor: pointer;
  font-family: inherit;
  color: var(--sd-text);
}

.color-chip.off {
  opacity: 0.45;
}

.chip-swatch {
  width: 28px;
  height: 28px;
  border: 2px solid var(--sd-border-light);
  image-rendering: pixelated;
}

.chip-tag {
  font-size: 10px;
  font-weight: 700;
}

.chip-count {
  font-size: 10px;
  color: var(--sd-primary-dark);
  font-weight: 600;
}

.drawer-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  -webkit-overflow-scrolling: touch;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  box-shadow: 2px 2px 0 0 var(--sd-shadow);
}

.color-row.off {
  opacity: 0.5;
}

.row-swatch {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.row-tag {
  font-weight: 700;
  font-size: 11px;
  min-width: 30px;
}

.row-hex {
  flex: 1;
  font-size: 10px;
  font-family: 'Cabin', monospace, sans-serif;
}
</style>
