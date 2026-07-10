<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { Button } from '@pixelium/web-vue/es'
import SdIcon from './SdIcon.vue'
import type { BeadColor } from '../data/beadColor'

const props = defineProps<{
  open: boolean
  current: BeadColor | null
  colors: BeadColor[]
}>()

const emit = defineEmits<{
  close: []
  select: [color: BeadColor]
}>()

const expandedGroups = ref<Set<string>>(new Set())
const dialogBodyRef = ref<HTMLElement | null>(null)

function getGroupLetter(tag: string): string {
  const first = tag.charAt(0)
  if (/[A-Za-z]/.test(first)) return first.toUpperCase()
  return '#'
}

function compareTags(a: string, b: string) {
  const letterA = getGroupLetter(a)
  const letterB = getGroupLetter(b)
  if (letterA !== letterB) return letterA.localeCompare(letterB)
  const numA = parseInt(a.replace(/^[A-Za-z#]+/, ''), 10)
  const numB = parseInt(b.replace(/^[A-Za-z#]+/, ''), 10)
  if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) return numA - numB
  return a.localeCompare(b, undefined, { numeric: true })
}

const colorGroups = computed(() => {
  const map = new Map<string, BeadColor[]>()

  for (const color of props.colors) {
    const letter = getGroupLetter(color.tag)
    if (!map.has(letter)) map.set(letter, [])
    map.get(letter)!.push(color)
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => {
      if (a === '#') return 1
      if (b === '#') return -1
      return a.localeCompare(b)
    })
    .map(([letter, items]) => ({
      letter,
      label: letter === '#' ? '数字' : letter,
      colors: [...items].sort((a, b) => compareTags(a.tag, b.tag)),
    }))
})

function currentGroupLetter(): string | null {
  if (!props.current) return null
  return getGroupLetter(props.current.tag)
}

watch(
  () => [props.open, props.current?.tag, props.colors.length] as const,
  ([open]) => {
    if (!open) return
    const letter = currentGroupLetter()
    expandedGroups.value = letter ? new Set([letter]) : new Set()
    nextTick(() => scrollToCurrent())
  },
)

function isGroupExpanded(letter: string) {
  return expandedGroups.value.has(letter)
}

function toggleGroup(letter: string) {
  const next = new Set(expandedGroups.value)
  if (next.has(letter)) next.delete(letter)
  else next.add(letter)
  expandedGroups.value = next
}

function scrollToCurrent() {
  if (!props.current || !dialogBodyRef.value) return
  const active = dialogBodyRef.value.querySelector('.sd-color-chip.active')
  active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function onSelect(color: BeadColor) {
  emit('select', color)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="sd-overlay color-pick-overlay" @click.self="emit('close')">
      <div class="sd-dialog color-pick-dialog" role="dialog" aria-modal="true" aria-labelledby="color-pick-title">
        <header class="sd-dialog-head-wood">
          <div class="dialog-title-wrap">
            <h3 id="color-pick-title" class="sd-dialog-title">更换颜色</h3>
            <p class="sd-dialog-sub">从当前色系中选择新色号</p>
          </div>
          <button type="button" class="sd-dialog-close" aria-label="关闭" @click="emit('close')">
            <SdIcon name="close" :size="16" />
          </button>
        </header>

        <div v-if="current" class="sd-dialog-info-bar">
          <span class="info-label">当前</span>
          <span class="sd-swatch info-swatch" :style="{ backgroundColor: current.hex }" />
          <span class="info-tag">{{ current.tag }}</span>
          <span class="info-hex sd-text-muted">{{ current.hex }}</span>
        </div>

        <div ref="dialogBodyRef" class="sd-dialog-scroll sd-pixel-grid-bg dialog-body">
          <section v-for="group in colorGroups" :key="group.letter" class="palette-group">
            <button
              type="button"
              class="sd-group-head"
              :aria-expanded="isGroupExpanded(group.letter)"
              @click="toggleGroup(group.letter)"
            >
              <SdIcon name="palette" :size="14" />
              <span class="sd-group-letter">{{ group.label }}</span>
              <span class="sd-group-meta">{{ group.colors.length }} 色</span>
              <span class="sd-group-chevron">
                <SdIcon :name="isGroupExpanded(group.letter) ? 'chevron-down' : 'chevron-right'" :size="12" />
              </span>
            </button>

            <div v-show="isGroupExpanded(group.letter)" class="palette-grid">
              <button
                v-for="color in group.colors"
                :key="color.tag"
                type="button"
                class="sd-color-chip"
                :class="{ active: current?.tag === color.tag }"
                :title="`${color.tag} ${color.hex}`"
                @click="onSelect(color)"
              >
                <span class="sd-swatch chip-swatch" :style="{ backgroundColor: color.hex }" />
                <span class="chip-tag">{{ color.tag }}</span>
                <SdIcon v-if="current?.tag === color.tag" name="check" :size="12" class="chip-active-icon" />
              </button>
            </div>
          </section>
        </div>

        <footer class="sd-dialog-foot">
          <Button block variant="outline" theme="info" @click="emit('close')">
            <span class="sd-btn-inner"><SdIcon name="close" :size="14" />取消</span>
          </Button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.color-pick-overlay {
  z-index: 300;
}

.palette-group + .palette-group {
  border-top: 1px dashed var(--sd-border-light);
}

.dialog-body {
  padding: 8px 0;
  border-bottom: 2px solid var(--sd-border-light);
}

.palette-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
  gap: 8px;
  padding: 4px 14px 12px;
}

.chip-swatch {
  width: 34px;
  height: 34px;
}

.chip-tag {
  font-size: 10px;
  font-weight: 700;
  font-family: var(--sd-font-display);
}

.chip-active-icon {
  flex-shrink: 0;
}

.info-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--sd-text-muted);
  letter-spacing: 0.06em;
}

.info-swatch {
  width: 24px;
  height: 24px;
}

.info-tag {
  font-size: 12px;
  font-weight: 700;
}

.info-hex {
  margin-left: auto;
  font-size: 11px;
  font-family: var(--sd-font-body);
}
</style>
