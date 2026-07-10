<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@pixelium/web-vue/es'

const props = defineProps<{
  current: number
  steps: string[]
}>()

const progress = computed(() => ((props.current + 1) / props.steps.length) * 100)
</script>

<template>
  <div class="step-header sd-panel">
    <div class="step-meta">
      <span class="step-counter">STEP {{ current + 1 }}/{{ steps.length }}</span>
      <Badge :value="`${current + 1}`" theme="primary" />
    </div>

    <div class="step-track sd-inset">
      <div class="step-progress" :style="{ width: `${progress}%` }" />
      <div
        v-for="(label, index) in steps"
        :key="label"
        class="step-item"
        :class="{
          active: index === current,
          done: index < current,
        }"
      >
        <div class="step-dot">
          <span v-if="index < current">✓</span>
          <span v-else>{{ index + 1 }}</span>
        </div>
        <span class="step-label">{{ label }}</span>
      </div>
    </div>

    <p class="step-tip">{{ steps[current] }}</p>
  </div>
</template>

<style scoped>
.step-header {
  margin: 12px 16px 0;
  padding: 12px;
  flex-shrink: 0;
}

.step-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.step-counter {
  font-size: 10px;
  color: var(--px-text-muted);
  letter-spacing: 0.08em;
}

.step-track {
  position: relative;
  display: flex;
  justify-content: space-between;
  gap: 4px;
  padding: 10px 8px 8px;
  background: var(--px-bg);
  overflow: hidden;
}

.step-progress {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: rgba(95, 160, 68, 0.15);
  transition: width 0.2s steps(4);
  pointer-events: none;
}

.step-item {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.step-dot {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  background: var(--px-surface);
  color: var(--px-text-muted);
  border: 2px solid var(--px-border);
  box-shadow: 2px 2px 0 0 var(--px-shadow);
  transition: background 0.15s, color 0.15s;
}

.step-item.active .step-dot {
  background: var(--px-primary);
  color: #fff;
}

.step-item.done .step-dot {
  background: var(--px-success);
  color: #fff;
}

.step-label {
  font-size: 9px;
  color: var(--px-text-muted);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.step-item.active .step-label {
  color: var(--px-primary-dark);
  font-weight: 700;
}

.step-item.done .step-label {
  color: var(--px-success-dark);
}

.step-tip {
  margin: 10px 0 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--px-text);
  text-align: center;
  line-height: 1.5;
}
</style>
