<script setup lang="ts">
import { computed } from 'vue'
import type { BeadCell } from '../utils/imageAnalysis'
import { getContrastTextColor } from '../utils/colorMatch'

const props = defineProps<{
  rows: number
  cols: number
  cells: BeadCell[]
  hiddenColors: Set<string>
  cellSize?: number
}>()

const cellSizePx = computed(() => props.cellSize ?? 28)

const gridCells = computed(() => {
  const map = new Map<string, BeadCell>()
  for (const cell of props.cells) {
    map.set(`${cell.row}-${cell.col}`, cell)
  }
  return map
})

function getCell(row: number, col: number) {
  return gridCells.value.get(`${row}-${col}`)
}

function isHidden(tag: string) {
  return props.hiddenColors.has(tag)
}

function rowLabel(row: number) {
  return String.fromCharCode(65 + row)
}
</script>

<template>
  <div v-if="cells.length" class="bead-grid-wrapper">
    <div class="bead-grid" :style="{ '--cell-size': cellSizePx + 'px' }">
      <div class="grid-row header-row">
        <div class="corner-cell" />
        <div v-for="col in cols" :key="'h' + col" class="header-cell">
          {{ col }}
        </div>
      </div>
      <div v-for="row in rows" :key="'r' + row" class="grid-row">
        <div class="header-cell row-label">{{ rowLabel(row - 1) }}</div>
        <div
          v-for="col in cols"
          :key="'c' + col"
          class="bead-cell"
          :class="{ hidden: getCell(row - 1, col - 1) && isHidden(getCell(row - 1, col - 1)!.color.tag) }"
          :style="{
            backgroundColor: getCell(row - 1, col - 1) && !isHidden(getCell(row - 1, col - 1)!.color.tag)
              ? getCell(row - 1, col - 1)!.color.hex
              : '#e8e8e8',
            color: getCell(row - 1, col - 1) && !isHidden(getCell(row - 1, col - 1)!.color.tag)
              ? getContrastTextColor(getCell(row - 1, col - 1)!.color.hex)
              : '#bbb',
          }"
        >
          <span v-if="getCell(row - 1, col - 1) && !isHidden(getCell(row - 1, col - 1)!.color.tag)" class="cell-label">
            {{ getCell(row - 1, col - 1)!.color.tag }}
          </span>
        </div>
      </div>
    </div>
    <p class="grid-info">{{ rows }} 行 × {{ cols }} 列，共 {{ cells.length }} 颗豆</p>
  </div>
  <el-empty v-else description="上传图纸并分析后，此处显示拼豆网格" />
</template>

<style scoped>
.bead-grid-wrapper {
  overflow: auto;
  padding: 8px;
}

.bead-grid {
  display: inline-block;
  border: 1px solid #dcdfe6;
  background: #fff;
}

.grid-row {
  display: flex;
}

.header-row .header-cell,
.row-label {
  background: #f5f7fa;
  font-weight: 600;
  color: #606266;
}

.corner-cell {
  width: var(--cell-size);
  height: var(--cell-size);
  flex-shrink: 0;
  background: #f5f7fa;
  border-right: 1px solid #e4e7ed;
  border-bottom: 1px solid #e4e7ed;
}

.header-cell {
  width: var(--cell-size);
  height: var(--cell-size);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  border-right: 1px solid #e4e7ed;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.bead-cell {
  width: var(--cell-size);
  height: var(--cell-size);
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
  box-sizing: border-box;
}

.bead-cell.hidden {
  background: #ececec !important;
}

.cell-label {
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
  text-align: center;
  pointer-events: none;
  text-shadow: 0 0 2px rgba(255, 255, 255, 0.5);
}

.grid-info {
  margin-top: 12px;
  font-size: 13px;
  color: #909399;
}
</style>
