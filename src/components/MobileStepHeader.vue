<script setup lang="ts">
defineProps<{
  current: number
  steps: string[]
}>()
</script>

<template>
  <div class="step-header">
    <div class="step-track">
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
  background: #fff;
  padding: 12px 16px 10px;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}

.step-track {
  display: flex;
  justify-content: space-between;
  gap: 4px;
}

.step-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.step-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  background: #e4e7ed;
  color: #909399;
  transition: all 0.2s;
}

.step-item.active .step-dot {
  background: #409eff;
  color: #fff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.35);
}

.step-item.done .step-dot {
  background: #67c23a;
  color: #fff;
}

.step-label {
  font-size: 10px;
  color: #909399;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.step-item.active .step-label {
  color: #409eff;
  font-weight: 600;
}

.step-item.done .step-label {
  color: #67c23a;
}

.step-tip {
  margin: 10px 0 0;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  text-align: center;
}
</style>
