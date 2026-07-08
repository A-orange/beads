<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import ImageSelector from './components/ImageSelector.vue'
import BeadGrid from './components/BeadGrid.vue'
import ColorPanel from './components/ColorPanel.vue'
import { analyzeGrid, detectGridFromSelection } from './utils/imageAnalysis'
import type { BeadCell } from './utils/imageAnalysis'
import type { SelectionRect } from './utils/imageAnalysis'

const gridRows = ref(0)
const gridCols = ref(0)
const resultRows = ref(0)
const resultCols = ref(0)
const cells = ref<BeadCell[]>([])
const colorVisibility = ref(new Map<string, boolean>())
const imageSelectorRef = ref<InstanceType<typeof ImageSelector> | null>(null)
const analyzing = ref(false)
const detecting = ref(false)

const hiddenColors = computed(() => {
  const hidden = new Set<string>()
  for (const [tag, visible] of colorVisibility.value) {
    if (!visible) hidden.add(tag)
  }
  return hidden
})

const resultLabel = computed(() => {
  if (resultRows.value > 0 && resultCols.value > 0) {
    return `${resultCols.value} × ${resultRows.value}`
  }
  return ''
})

function initColorVisibility(beadCells: BeadCell[]) {
  const map = new Map<string, boolean>()
  for (const cell of beadCells) {
    if (!map.has(cell.color.tag)) {
      map.set(cell.color.tag, true)
    }
  }
  colorVisibility.value = map
}

async function handleDetectGrid(selection: SelectionRect) {
  const img = imageSelectorRef.value?.imageRef
  if (!img?.naturalWidth) return

  detecting.value = true
  try {
    await new Promise((r) => requestAnimationFrame(r))
    const detected = detectGridFromSelection(img, selection)
    gridRows.value = detected.rows
    gridCols.value = detected.cols
  } catch {
    // 自动识别失败时保留当前手动值
  } finally {
    detecting.value = false
  }
}

async function handleAnalyze(selection: SelectionRect) {
  const img = imageSelectorRef.value?.imageRef
  if (!img?.naturalWidth) {
    ElMessage.warning('图片尚未加载完成，请稍后再试')
    return
  }

  analyzing.value = true
  try {
    await new Promise((r) => requestAnimationFrame(r))
    const useManual = gridRows.value > 0 && gridCols.value > 0
    const result = analyzeGrid(img, selection, useManual
      ? { rows: gridRows.value, cols: gridCols.value }
      : undefined)
    resultRows.value = result.rows
    resultCols.value = result.cols
    gridRows.value = result.rows
    gridCols.value = result.cols
    cells.value = result.cells
    initColorVisibility(result.cells)
    const modeHint = useManual ? '手动网格' : '自动识别'
    const trimHint = result.trimmed ? '，已裁剪非图案区域' : ''
    ElMessage.success(`${modeHint}：${result.rows} 行 × ${result.cols} 列，共 ${result.cells.length} 颗豆${trimHint}`)
  } catch (e) {
    ElMessage.error('分析失败：' + (e instanceof Error ? e.message : '未知错误'))
  } finally {
    analyzing.value = false
  }
}

function onToggleColor(tag: string, visible: boolean) {
  colorVisibility.value.set(tag, visible)
  colorVisibility.value = new Map(colorVisibility.value)
}

function onToggleAll(visible: boolean) {
  const map = new Map(colorVisibility.value)
  for (const key of map.keys()) {
    map.set(key, visible)
  }
  colorVisibility.value = map
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>拼豆图纸分析器</h1>
      <p class="subtitle">框选区域 → 调整网格对齐 → 分析并匹配 MARD 221 标准色</p>
    </header>

    <div class="controls">
      <el-tag v-if="resultLabel" type="success">分析结果：{{ resultLabel }}</el-tag>
      <el-tag v-else-if="gridRows > 0" type="warning">预览网格：{{ gridCols }} × {{ gridRows }}</el-tag>
      <el-tag v-else type="info">框选后自动识别网格，可手动微调行列数</el-tag>
      <el-tag type="info">MARD 221 色</el-tag>
    </div>

    <div class="main-layout">
      <section class="panel source-panel">
        <h2>原图选区</h2>
        <ImageSelector
          ref="imageSelectorRef"
          v-model:rows="gridRows"
          v-model:cols="gridCols"
          :detecting="detecting"
          @detect="handleDetectGrid"
          @analyze="handleAnalyze"
        />
      </section>

      <section class="panel grid-panel">
        <h2>拼豆网格</h2>
        <div v-loading="analyzing" class="grid-container">
          <BeadGrid
            :rows="resultRows"
            :cols="resultCols"
            :cells="cells"
            :hidden-colors="hiddenColors"
          />
        </div>
      </section>

      <aside class="panel side-panel">
        <ColorPanel
          :cells="cells"
          :color-visibility="colorVisibility"
          @toggle="onToggleColor"
          @toggle-all="onToggleAll"
        />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  box-sizing: border-box;
}

.app-header {
  margin-bottom: 12px;
}

.app-header h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}

.subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: #909399;
}

.controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

.main-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1.2fr 280px;
  gap: 16px;
  min-height: 0;
}

.panel {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  min-height: 500px;
  overflow: hidden;
}

.panel h2 {
  margin: 0;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #606266;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.source-panel :deep(.image-selector) {
  padding: 0 16px 16px;
  flex: 1;
  min-height: 0;
}

.grid-container {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

.side-panel {
  border: none;
  background: transparent;
  min-height: 500px;
}

@media (max-width: 1200px) {
  .main-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
  }

  .panel {
    min-height: 400px;
  }
}
</style>
