<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PALETTE_BRANDS, isPaletteAvailable } from '../data/paletteRegistry'
import { usePaletteState, loadPalette } from '../services/paletteService'

const props = defineProps<{
  compact?: boolean
  embedded?: boolean
}>()

const emit = defineEmits<{
  change: [paletteId: string]
}>()

const { activePaletteId, activeLabel, loading } = usePaletteState()

const brandId = ref('mard')
const setId = ref(activePaletteId.value)

const currentBrand = computed(
  () => PALETTE_BRANDS.find((b) => b.id === brandId.value) ?? PALETTE_BRANDS[0]!,
)

const availableSets = computed(() =>
  currentBrand.value.sets.filter((s) => isPaletteAvailable(s)),
)

watch(
  activePaletteId,
  (id) => {
    const meta = PALETTE_BRANDS.flatMap((b) =>
      b.sets.map((s) => ({ brandId: b.id, setId: s.id })),
    ).find((x) => x.setId === id)
    if (meta) {
      brandId.value = meta.brandId
      setId.value = meta.setId
    }
  },
  { immediate: true },
)

watch(brandId, async () => {
  const first = availableSets.value[0]
  if (first && !availableSets.value.some((s) => s.id === setId.value)) {
    setId.value = first.id
    await onSetChange()
  }
})

async function onSetChange() {
  if (!setId.value || setId.value === activePaletteId.value) return
  if (!isPaletteAvailable(currentBrand.value.sets.find((s) => s.id === setId.value)!)) return
  try {
    await loadPalette(setId.value)
    emit('change', setId.value)
  } catch {
    setId.value = activePaletteId.value
  }
}
</script>

<template>
  <div class="palette-selector variant-pixel" :class="{ compact, embedded }">
    <label v-if="!compact" class="selector-label">拼豆色号</label>
    <div class="selector-row">
      <select v-model="brandId" class="selector-input" :disabled="loading">
        <option v-for="brand in PALETTE_BRANDS" :key="brand.id" :value="brand.id">
          {{ brand.name }}
        </option>
      </select>
      <select
        v-model="setId"
        class="selector-input"
        :disabled="loading || !availableSets.length"
        @change="onSetChange"
      >
        <option v-for="set in currentBrand.sets" :key="set.id" :value="set.id" :disabled="!isPaletteAvailable(set)">
          {{ set.label }}{{ isPaletteAvailable(set) ? '' : '（待支持）' }}
        </option>
      </select>
    </div>
    <p v-if="!compact" class="selector-hint">{{ activeLabel }} · {{ loading ? '加载中…' : '分析时将匹配此色卡' }}</p>
  </div>
</template>

<style scoped>
.palette-selector {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.selector-label {
  font-size: 11px;
  font-weight: 600;
  color: #606266;
}

.selector-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.selector-input {
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  color: #303133;
}

.selector-input:disabled {
  opacity: 0.6;
}

.selector-hint {
  margin: 0;
  font-size: 10px;
  color: #909399;
}

.palette-selector.embedded {
  gap: 4px;
}

.palette-selector.embedded .selector-input {
  height: 28px;
  font-size: 11px;
  padding: 0 6px;
}

.variant-pixel .selector-label,
.variant-pixel .selector-hint {
  color: var(--sd-text-muted, #7a6a52);
}

.variant-pixel .selector-input {
  border: 2px solid var(--sd-border-light, #c4a882);
  border-radius: 0;
  background: var(--sd-surface, #fff8ee);
  color: var(--sd-text, #3e2723);
  box-shadow: 2px 2px 0 0 var(--sd-shadow, #5c4033);
}
</style>
