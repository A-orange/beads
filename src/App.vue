<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import ImageSelector from './components/ImageSelector.vue'
import type { SelectorMode } from './components/ImageSelector.vue'
import BeadGrid from './components/BeadGrid.vue'
import ColorPanel from './components/ColorPanel.vue'
import MobileStepHeader from './components/MobileStepHeader.vue'
import { useIsMobile } from './composables/useIsMobile'
import { analyzeGrid, detectGridFromSelection } from './utils/imageAnalysis'
import type { BeadCell } from './utils/imageAnalysis'
import type { SelectionRect } from './utils/imageAnalysis'

const { isMobile } = useIsMobile()

const WIZARD_STEPS = ['上传图纸', '框选区域', '对齐网格', '查看结果']

const mobileStep = ref(0)
const gridRows = ref(0)
const gridCols = ref(0)
const resultRows = ref(0)
const resultCols = ref(0)
const cells = ref<BeadCell[]>([])
const colorVisibility = ref(new Map<string, boolean>())
const imageSelectorRef = ref<InstanceType<typeof ImageSelector> | null>(null)
const analyzing = ref(false)
const detecting = ref(false)
const hasSelection = ref(false)
const resultTab = ref('grid')

const hiddenColors = computed(() => {
  const hidden = new Set<string>()
  for (const [tag, visible] of colorVisibility.value) {
    if (!visible) hidden.add(tag)
  }
  return hidden
})

const selectorMode = computed<SelectorMode>(() => {
  if (!isMobile.value) return mobileStep.value === 0 ? 'upload' : 'adjust'
  if (mobileStep.value === 0) return 'upload'
  if (mobileStep.value === 1) return 'select'
  if (mobileStep.value === 2) return 'adjust'
  return 'adjust'
})

const mobileGuideText = computed(() => {
  const texts = [
    '选择一张拼豆图纸，支持相册或文件',
    '用手指拖拽框选图案区域，尽量包住整个网格',
    '调整行列数，让白色网格线与图纸对齐',
    '查看拼豆网格和颜色用量清单',
  ]
  return texts[mobileStep.value] ?? ''
})

function initColorVisibility(beadCells: BeadCell[]) {
  const map = new Map<string, boolean>()
  for (const cell of beadCells) {
    if (!map.has(cell.color.tag)) map.set(cell.color.tag, true)
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
    // keep manual values
  } finally {
    detecting.value = false
  }
}

async function runAnalyze(selection?: SelectionRect) {
  const img = imageSelectorRef.value?.imageRef
  const sel = selection ?? imageSelectorRef.value?.getSelection?.()
  if (!img?.naturalWidth || !sel) {
    ElMessage.warning('请先框选图案区域')
    return false
  }

  analyzing.value = true
  try {
    await new Promise((r) => requestAnimationFrame(r))
    const useManual = gridRows.value > 0 && gridCols.value > 0
    const result = analyzeGrid(img, sel, useManual
      ? { rows: gridRows.value, cols: gridCols.value }
      : undefined)
    resultRows.value = result.rows
    resultCols.value = result.cols
    gridRows.value = result.rows
    gridCols.value = result.cols
    cells.value = result.cells
    initColorVisibility(result.cells)
    return true
  } catch (e) {
    ElMessage.error('分析失败：' + (e instanceof Error ? e.message : '未知错误'))
    return false
  } finally {
    analyzing.value = false
  }
}

async function handleAnalyze(selection: SelectionRect) {
  const ok = await runAnalyze(selection)
  if (ok && isMobile.value) {
    mobileStep.value = 3
    ElMessage.success(`共 ${cells.value.length} 颗豆，${new Set(cells.value.map((c) => c.color.tag)).size} 种颜色`)
  } else if (ok) {
    ElMessage.success(`分析完成：${resultRows.value} 行 × ${resultCols.value} 列`)
  }
}

function onUploaded() {
  if (isMobile.value) mobileStep.value = 1
}

function onSelectionChange(selected: boolean) {
  hasSelection.value = selected
}

async function goToGridStep() {
  if (!hasSelection.value) {
    ElMessage.warning('请先框选图案区域')
    return
  }
  mobileStep.value = 2
  const sel = imageSelectorRef.value?.getSelection?.()
  if (sel) await handleDetectGrid(sel)
}

async function analyzeAndShowResult() {
  const ok = await runAnalyze()
  if (ok) {
    mobileStep.value = 3
    resultTab.value = 'grid'
    ElMessage.success(`分析完成，共 ${cells.value.length} 颗豆`)
  }
}

function mobilePrev() {
  if (mobileStep.value > 0) mobileStep.value--
}

function resetWizard() {
  imageSelectorRef.value?.resetImage?.()
  mobileStep.value = 0
  hasSelection.value = false
  gridRows.value = 0
  gridCols.value = 0
  resultRows.value = 0
  resultCols.value = 0
  cells.value = []
  colorVisibility.value = new Map()
}

function onToggleColor(tag: string, visible: boolean) {
  colorVisibility.value.set(tag, visible)
  colorVisibility.value = new Map(colorVisibility.value)
}

function onToggleAll(visible: boolean) {
  const map = new Map(colorVisibility.value)
  for (const key of map.keys()) map.set(key, visible)
  colorVisibility.value = map
}

watch(isMobile, (mobile) => {
  if (!mobile && mobileStep.value === 0) mobileStep.value = 0
})
</script>

<template>
  <!-- 移动端：分步引导 -->
  <div v-if="isMobile" class="mobile-app">
    <header class="mobile-title">
      <h1>拼豆图纸分析</h1>
      <span class="badge">MARD 221</span>
    </header>

    <MobileStepHeader :current="mobileStep" :steps="WIZARD_STEPS" />

    <p class="guide-text">{{ mobileGuideText }}</p>

    <main class="mobile-main">
      <ImageSelector
        v-if="mobileStep < 3"
        ref="imageSelectorRef"
        :mode="selectorMode"
        v-model:rows="gridRows"
        v-model:cols="gridCols"
        :detecting="detecting"
        :show-analyze="false"
        @uploaded="onUploaded"
        @selection-change="onSelectionChange"
        @detect="handleDetectGrid"
        @analyze="handleAnalyze"
      />

      <div v-else class="result-panel">
        <el-tabs v-model="resultTab" class="result-tabs">
          <el-tab-pane label="拼豆网格" name="grid">
            <div class="result-scroll">
              <BeadGrid
                :rows="resultRows"
                :cols="resultCols"
                :cells="cells"
                :hidden-colors="hiddenColors"
                :cell-size="18"
              />
            </div>
          </el-tab-pane>
          <el-tab-pane label="颜色清单" name="colors">
            <div class="result-scroll color-tab">
              <ColorPanel
                :cells="cells"
                :color-visibility="colorVisibility"
                @toggle="onToggleColor"
                @toggle-all="onToggleAll"
              />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </main>

    <footer class="mobile-footer">
      <template v-if="mobileStep === 0">
        <p class="footer-tip">上传后进入下一步</p>
      </template>

      <template v-else-if="mobileStep === 1">
        <el-button class="footer-btn" @click="mobilePrev">上一步</el-button>
        <el-button
          class="footer-btn primary"
          type="primary"
          :disabled="!hasSelection"
          @click="goToGridStep"
        >
          下一步
        </el-button>
      </template>

      <template v-else-if="mobileStep === 2">
        <el-button class="footer-btn" @click="mobilePrev">上一步</el-button>
        <el-button
          class="footer-btn primary"
          type="primary"
          :loading="analyzing"
          :disabled="!gridRows || !gridCols"
          @click="analyzeAndShowResult"
        >
          开始分析
        </el-button>
      </template>

      <template v-else>
        <el-button class="footer-btn" @click="mobileStep = 2">返回调整</el-button>
        <el-button class="footer-btn primary" type="primary" @click="resetWizard">
          重新开始
        </el-button>
      </template>
    </footer>
  </div>

  <!-- 桌面端：多栏布局 -->
  <div v-else class="desktop-app">
    <header class="app-header">
      <h1>拼豆图纸分析器</h1>
      <p class="subtitle">框选区域 → 调整网格对齐 → 分析并匹配 MARD 221 标准色</p>
    </header>

    <div class="main-layout">
      <section class="panel source-panel">
        <h2>原图选区</h2>
        <ImageSelector
          ref="imageSelectorRef"
          mode="adjust"
          v-model:rows="gridRows"
          v-model:cols="gridCols"
          :detecting="detecting"
          @selection-change="onSelectionChange"
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
/* ===== 移动端 ===== */
.mobile-app {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  padding-bottom: env(safe-area-inset-bottom);
}

.mobile-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 0;
  background: #fff;
}

.mobile-title h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.badge {
  font-size: 11px;
  color: #409eff;
  background: #ecf5ff;
  padding: 3px 8px;
  border-radius: 10px;
}

.guide-text {
  margin: 0;
  padding: 8px 16px 12px;
  font-size: 13px;
  color: #909399;
  text-align: center;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}

.mobile-main {
  flex: 1;
  min-height: 0;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mobile-main :deep(.image-selector) {
  flex: 1;
  min-height: 0;
}

.result-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e4e7ed;
  overflow: hidden;
}

.result-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.result-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 12px;
}

.result-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}

.result-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.result-scroll {
  height: 100%;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.result-scroll.color-tab :deep(.color-panel) {
  border: none;
  border-radius: 0;
  height: auto;
  min-height: 100%;
}

.mobile-footer {
  display: flex;
  gap: 10px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #ebeef5;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}

.footer-tip {
  flex: 1;
  margin: 0;
  text-align: center;
  font-size: 13px;
  color: #909399;
  line-height: 40px;
}

.footer-btn {
  flex: 1;
  height: 44px;
  font-size: 15px;
}

.footer-btn.primary {
  flex: 1.4;
}

/* ===== 桌面端 ===== */
.desktop-app {
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
}

.subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: #909399;
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
}
</style>
