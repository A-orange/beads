<script setup lang="ts">
type TagColor =
  | 'default'
  | 'app-pink'
  | 'purple'
  | 'app-blue'
  | 'app-yellow'
  | 'app-orange'
  | 'app-teal'
  | 'app-green'
  | 'app-red'
  | 'lime-green'
  | 'yellow-green'
  | 'brown'
  | 'warm-peach-pink'

type TagSize = 'small' | 'medium' | 'large'

withDefaults(
  defineProps<{
    color?: TagColor
    size?: TagSize
  }>(),
  {
    color: 'default',
    size: 'small',
  },
)
</script>

<template>
  <span class="island-tag" :class="[`island-tag--${color}`, `island-tag--${size}`]">
    <slot />
  </span>
</template>
