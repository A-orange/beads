<script setup lang="ts">
import { computed } from 'vue'
import { ICONS, type IconName } from './icons/iconPaths'

const props = withDefaults(
  defineProps<{
    name: IconName
    size?: number | string
  }>(),
  { size: 16 },
)

const icon = computed(() => ICONS[props.name])

const pathList = computed(() => {
  const paths = icon.value.paths
  return Array.isArray(paths) ? paths : [paths]
})
</script>

<template>
  <svg
    class="sd-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      v-for="(d, index) in pathList"
      :key="index"
      :d="d"
      :fill="icon.fill ? 'currentColor' : 'none'"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.sd-icon {
  display: block;
  flex-shrink: 0;
}
</style>
