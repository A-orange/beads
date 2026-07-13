<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Select } from 'animal-island-vue'
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

const brandOptions = computed(() =>
  PALETTE_BRANDS.map((brand) => ({
    key: brand.id,
    label: brand.name,
  })),
)

const setOptions = computed(() =>
  currentBrand.value.sets.map((set) => ({
    key: set.id,
    label: `${set.label}${isPaletteAvailable(set) ? '' : '（待支持）'}`,
  })),
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
  <div class="palette-selector" :class="{ compact, embedded }">
    <label v-if="!compact" class="selector-label">拼豆色号</label>
    <div class="selector-row">
      <Select
        v-model="brandId"
        :options="brandOptions"
        :disabled="loading"
        placeholder="品牌"
      />
      <Select
        v-model="setId"
        :options="setOptions"
        :disabled="loading || !availableSets.length"
        placeholder="色卡"
        @change="onSetChange"
      />
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
  font-size: 12px;
  font-weight: 600;
  color: #725d42;
}

.selector-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.selector-hint {
  margin: 0;
  font-size: 11px;
  color: var(--sd-text-muted);
}

.palette-selector.embedded {
  gap: 4px;
}
</style>
