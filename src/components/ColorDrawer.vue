<script setup lang="ts">
import { computed, ref } from 'vue'
import { Checkbox, Tag } from '@pixelium/web-vue/es'
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
</script>

<template>
  <div class="color-drawer framed" :class="{ expanded }">
    <button type="button" class="sd-drawer-handle drawer-handle" @click="toggleExpanded">
      <span class="sd-drawer-handle-bar" />
      <SdIcon name="list" :size="14" />
      <span class="sd-drawer-handle-title">色卡清单</span>
      <Tag theme="notice" size="small">{{ colorUsages.length }} 色</Tag>
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
        <div class="row-check">
          <Checkbox
            variant="retro"
            :model-value="item.visible"
            @update:model-value="(val: boolean) => emit('toggle', item.color.tag, val)"
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
          <Tag v-if="item.isBackground" theme="info" size="small" variant="plain">背景</Tag>
          <Tag v-else theme="primary" size="small" variant="plain">{{ item.count }}</Tag>
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
  background: linear-gradient(180deg, var(--sd-surface-wood) 0%, #c9ad82 100%);
  border: none;
  border-top: var(--sd-border-width) solid var(--sd-wood);
  border-radius: 0;
  box-shadow: none;
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

.row-picker-icon {
  flex-shrink: 0;
  opacity: 0.55;
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
  box-shadow: 2px 2px 0 0 var(--sd-shadow);
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
  color: var(--sd-text);
  text-align: left;
}

.row-color:active {
  background: rgba(95, 160, 68, 0.08);
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
  background: var(--sd-surface);
  color: var(--sd-text-muted);
  cursor: pointer;
  box-shadow: 1px 1px 0 0 var(--sd-shadow);
}

.row-bg-btn.active {
  background: rgba(95, 160, 68, 0.18);
  border-color: var(--sd-primary);
  color: var(--sd-primary-dark);
}

.row-bg-btn:active {
  transform: translate(1px, 1px);
  box-shadow: none;
}

.row-swatch {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.row-swatch.swatch-bg {
  opacity: 0.35;
  box-shadow: inset 0 0 0 1px var(--sd-border-light);
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
