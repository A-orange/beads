<script setup lang="ts">
import { computed } from 'vue'
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
    const numA = parseInt(a.color.tag.slice(1), 10)
    const numB = parseInt(b.color.tag.slice(1), 10)
    return numA - numB
  })
})

const totalBeads = computed(() => props.cells.length)
const visibleBeads = computed(() =>
  props.cells.filter((c) => props.colorVisibility.get(c.color.tag) !== false).length,
)

function onToggle(tag: string, visible: boolean) {
  emit('toggle', tag, visible)
}
</script>

<template>
  <div class="color-panel">
    <div class="panel-header">
      <h3>颜色清单</h3>
      <div class="actions">
        <el-button size="small" text @click="emit('toggleAll', true)">全选</el-button>
        <el-button size="small" text @click="emit('toggleAll', false)">全不选</el-button>
      </div>
    </div>

    <div v-if="colorUsages.length" class="summary">
      <span>{{ colorUsages.length }} 种颜色</span>
      <span>显示 {{ visibleBeads }} / {{ totalBeads }} 颗</span>
    </div>

    <div v-if="colorUsages.length" class="color-list">
      <label
        v-for="item in colorUsages"
        :key="item.color.tag"
        class="color-item"
        :class="{ disabled: !item.visible }"
      >
        <el-checkbox
          :model-value="item.visible"
          @change="(val: boolean) => onToggle(item.color.tag, val)"
        />
        <span class="swatch" :style="{ backgroundColor: item.color.hex }" />
        <span class="tag">{{ item.color.tag }}</span>
        <span class="hex">{{ item.color.hex }}</span>
        <span class="count">{{ item.count }}</span>
      </label>
    </div>

    <el-empty v-else description="暂无颜色数据" :image-size="80" />
  </div>
</template>

<style scoped>
.color-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 8px;
  border-bottom: 1px solid #f0f0f0;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 4px;
}

.summary {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  font-size: 12px;
  color: #909399;
  background: #fafafa;
}

.color-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.color-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.color-item:hover {
  background: #f5f7fa;
}

.color-item.disabled {
  opacity: 0.45;
}

.swatch {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.tag {
  font-weight: 700;
  font-size: 13px;
  min-width: 36px;
}

.hex {
  font-size: 11px;
  color: #909399;
  font-family: monospace;
  flex: 1;
}

.count {
  font-weight: 600;
  font-size: 14px;
  min-width: 28px;
  text-align: right;
  color: #409eff;
}
</style>
