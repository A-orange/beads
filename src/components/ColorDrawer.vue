<script setup lang="ts">
import { computed, ref } from 'vue'
import { Checkbox } from 'animal-island-vue'
import IslandTag from './IslandTag.vue'
import PaletteSelector from './PaletteSelector.vue'
import ColorPickDialog from './ColorPickDialog.vue'
import SdIcon from './SdIcon.vue'
import { usePaletteState } from '../services/paletteService'
import { countsAsBead } from '../utils/beadColorRoles'
import type { BeadColor } from '../data/beadColor'
import type { BeadCell } from '../utils/imageAnalysis'
import type { ColorUsage } from '../types'

const props = defineProps<{
  cells: BeadCell[]
  colorVisibility: Map<string, boolean>
  backgroundColors: Set<string>
  hiddenColors: Set<string>
}>()

const emit = defineEmits<{
  toggle: [tag: string, visible: boolean]
  toggleBackground: [tag: string, isBackground: boolean]
  replaceColor: [fromTag: string, color: BeadColor]
  paletteChange: [paletteId: string]
}>()

const { activeColors } = usePaletteState()

const expanded = defineModel<boolean>('expanded', { default: false })
const pickerOpen = ref(false)
const pickingTag = ref<string | null>(null)

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
        isBackground: props.backgroundColors.has(cell.color.tag),
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
  props.cells.filter((c) =>
    countsAsBead(c.color.tag, props.hiddenColors, props.backgroundColors),
  ).length,
)

const pickingColor = computed(() => {
  if (!pickingTag.value) return null
  return colorUsages.value.find((u) => u.color.tag === pickingTag.value)?.color ?? null
})

function toggleExpanded() {
  expanded.value = !expanded.value
}

function openPicker(tag: string) {
  pickingTag.value = tag
  pickerOpen.value = true
}

function closePicker() {
  pickerOpen.value = false
  pickingTag.value = null
}

function onPickColor(color: BeadColor) {
  if (pickingTag.value) emit('replaceColor', pickingTag.value, color)
}

function toggleBackground(tag: string, isBackground: boolean) {
  emit('toggleBackground', tag, isBackground)
}

function onCheckboxChange(tag: string, values: Array<string | number>) {
  emit('toggle', tag, values.includes(tag))
}
</script>

<template>
  <div class="color-drawer framed" :class="{ expanded }">
    <button type="button" class="sd-drawer-handle drawer-handle" @click="toggleExpanded">
      <span class="sd-drawer-handle-bar" />
      <SdIcon name="list" :size="14" />
      <span class="sd-drawer-handle-title">色卡清单</span>
      <IslandTag color="app-yellow">{{ colorUsages.length }} 色</IslandTag>
      <span class="handle-meta sd-body">{{ visibleBeads }}/{{ cells.length }} 颗</span>
      <SdIcon :name="expanded ? 'chevron-down' : 'chevron-up'" :size="12" />
    </button>

    <div class="drawer-palette">
      <PaletteSelector compact embedded @change="emit('paletteChange', $event)" />
    </div>

    <div v-show="expanded" class="drawer-body sd-pixel-grid-bg">
      <div
        v-for="item in colorUsages"
        :key="item.color.tag"
        class="color-row sd-panel"
        :class="{ off: !item.visible, 'is-background': item.isBackground }"
      >
        <div class="row-check island-checkbox-solo">
          <Checkbox
            :model-value="item.visible ? [item.color.tag] : []"
            :options="[{ label: '', value: item.color.tag }]"
            size="small"
            @update:model-value="onCheckboxChange(item.color.tag, $event)"
          />
        </div>
        <button type="button" class="row-color" @click="openPicker(item.color.tag)">
          <span
            class="row-swatch sd-inset"
            :class="{ 'swatch-bg': item.isBackground }"
            :style="{ backgroundColor: item.color.hex }"
          />
          <span class="row-tag">{{ item.color.tag }}</span>
          <span class="row-hex sd-text-muted">{{ item.color.hex }}</span>
          <IslandTag v-if="item.isBackground" color="app-blue">背景</IslandTag>
          <IslandTag v-else color="app-teal">{{ item.count }}</IslandTag>
        </button>
        <button
          type="button"
          class="row-bg-btn"
          :class="{ active: item.isBackground }"
          :title="item.isBackground ? '取消背景色' : '设为背景色（不拼豆）'"
          @click="toggleBackground(item.color.tag, !item.isBackground)"
        >
          <SdIcon name="background" :size="14" />
        </button>
      </div>
    </div>
  </div>

  <ColorPickDialog
    :open="pickerOpen"
    :current="pickingColor"
    :colors="activeColors"
    @close="closePicker"
    @select="onPickColor"
  />
</template>

<style scoped>
.color-drawer {
  position: relative;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: 0;
}

.color-drawer.framed {
  background: transparent;
  border: none;
  border-top: 1px solid rgba(114, 93, 66, 0.12);
  border-radius: 0;
}

.color-drawer.framed .drawer-palette {
  border-bottom: none;
}

.color-drawer.framed.expanded .drawer-palette {
  border-bottom: 1px dashed var(--sd-border-light);
}

.color-drawer.expanded {
  flex: 1;
  min-height: 0;
  border-top-width: 0;
}

.drawer-handle {
  flex-shrink: 0;
}

.handle-meta {
  font-size: 11px;
  color: var(--sd-text-muted);
}

.drawer-palette {
  flex-shrink: 0;
  padding: 0 10px 10px;
  border-bottom: 1px dashed var(--sd-border-light);
}

.drawer-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  -webkit-overflow-scrolling: touch;
}

.color-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.color-row.off {
  opacity: 0.5;
}

.color-row.is-background {
  opacity: 0.72;
}

.row-check {
  display: flex;
  align-items: center;
  padding: 8px 4px 8px 10px;
  flex-shrink: 0;
}

.row-check :deep(span:empty) {
  display: none;
}

.row-color {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 8px 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  color: #725d42;
  text-align: left;
}

.row-color:active {
  background: rgba(25, 200, 185, 0.08);
}

.row-bg-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  margin: 6px 6px 6px 0;
  padding: 0;
  border: 2px solid var(--sd-border-light);
  border-radius: 12px;
  background: var(--sd-bg);
  color: var(--sd-text-muted);
  cursor: pointer;
}

.row-bg-btn.active {
  background: var(--animal-primary-color-bg, #e6f9f6);
  border-color: var(--sd-primary);
  color: var(--sd-primary-dark);
}

.row-swatch {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 8px;
}

.row-swatch.swatch-bg {
  opacity: 0.35;
}

.row-tag {
  font-weight: 700;
  font-size: 11px;
  min-width: 30px;
}

.row-hex {
  flex: 1;
  font-size: 10px;
}
</style>
