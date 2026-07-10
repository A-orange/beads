<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Button, Tag, TextOutline } from '@pixelium/web-vue/es'
import ImageUpload from './components/ImageUpload.vue'
import GridAlignEditor from './components/GridAlignEditor.vue'
import BeadGrid from './components/BeadGrid.vue'
import ColorPanel from './components/ColorPanel.vue'
import MobileStepHeader from './components/MobileStepHeader.vue'
import MobileResultView from './components/MobileResultView.vue'
import { useIsMobile } from './composables/useIsMobile'
import { PixelMessage } from './utils/pixelMessage'
import { analyzeAlignedGrid } from './utils/imageAnalysis'
import type { BeadCell } from './utils/imageAnalysis'

const { isMobile } = useIsMobile()

const WIZARD_STEPS = ['上传图纸', '对齐网格', '查看结果']

const mobileStep = ref(0)
const imageUrl = ref<string | null>(null)
const gridRows = ref(0)
const gridCols = ref(0)
const cellWidth = ref(0)
const cellHeight = ref(0)
const gridColor = ref('#ffffff')
const resultRows = ref(0)
const resultCols = ref(0)
const cells = ref<BeadCell[]>([])
const colorVisibility = ref(new Map<string, boolean>())
const gridEditorRef = ref<InstanceType<typeof GridAlignEditor> | null>(null)
const analyzing = ref(false)

const hiddenColors = computed(() => {
  const hidden = new Set<string>()
  for (const [tag, visible] of colorVisibility.value) {
    if (!visible) hidden.add(tag)
  }
  return hidden
})

const mobileGuideText = computed(() => {
  const texts = [
    '上传拼豆图纸',
    '先调整图片大小位置，锁定后对齐网格',
    '查看拼豆结果，底部色卡可切换颜色',
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

function onUploaded(url: string) {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = url
  gridRows.value = 0
  gridCols.value = 0
  cellWidth.value = 0
  cellHeight.value = 0
  gridColor.value = '#ffffff'
  mobileStep.value = 1
}

async function runAnalyze(): Promise<boolean> {
  const img = gridEditorRef.value?.imageRef
  if (!img?.naturalWidth) {
    const msg = '图片尚未加载完成'
    if (isMobile.value) PixelMessage.warning(msg)
    else ElMessage.warning(msg)
    return false
  }
  if (!gridRows.value || !gridCols.value) {
    const msg = '请先设置行列数'
    if (isMobile.value) PixelMessage.warning(msg)
    else ElMessage.warning(msg)
    return false
  }
  if (!cellWidth.value || !cellHeight.value) {
    const msg = '请先设置格子宽高'
    if (isMobile.value) PixelMessage.warning(msg)
    else ElMessage.warning(msg)
    return false
  }

  analyzing.value = true
  try {
    await new Promise((r) => requestAnimationFrame(r))
    const alignment = gridEditorRef.value?.getGridAlignment?.() ?? {
      offsetX: 0,
      offsetY: 0,
      cellWidth: 0,
      cellHeight: 0,
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageScale: 1,
      gridScale: 1,
    }
    const result = analyzeAlignedGrid(img, gridRows.value, gridCols.value, alignment)
    resultRows.value = result.rows
    resultCols.value = result.cols
    cells.value = result.cells
    initColorVisibility(result.cells)
    return true
  } catch (e) {
    const msg = '分析失败：' + (e instanceof Error ? e.message : '未知错误')
    if (isMobile.value) PixelMessage.error(msg)
    else ElMessage.error(msg)
    return false
  } finally {
    analyzing.value = false
  }
}

async function analyzeAndShowResult() {
  const ok = await runAnalyze()
  if (ok && isMobile.value) {
    mobileStep.value = 2
    PixelMessage.success(`分析完成，共 ${cells.value.length} 颗豆`)
  } else if (ok) {
    ElMessage.success(`分析完成：${resultRows.value} 行 × ${resultCols.value} 列`)
  }
}

async function handleDesktopAnalyze() {
  await runAnalyze()
}

function mobilePrev() {
  if (mobileStep.value > 0) mobileStep.value--
}

function resetWizard() {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = null
  mobileStep.value = 0
  gridRows.value = 0
  gridCols.value = 0
  cellWidth.value = 0
  cellHeight.value = 0
  gridColor.value = '#ffffff'
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

onUnmounted(() => {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
})
</script>

<template>
  <!-- 移动端 -->
  <div v-if="isMobile" class="mobile-app" :class="{ 'is-align-step': mobileStep === 1 }">
    <header v-if="mobileStep !== 1" class="mobile-title sd-panel-wood">
      <TextOutline outline-width="2" color="var(--sd-wood)">
        <h1 class="sd-heading">拼豆图纸分析</h1>
      </TextOutline>
      <Tag theme="success" size="small">MARD 221</Tag>
    </header>

    <MobileStepHeader v-if="mobileStep === 0" :current="mobileStep" :steps="WIZARD_STEPS" />

    <p v-if="mobileStep === 0" class="guide-text sd-body sd-text-muted">{{ mobileGuideText }}</p>

    <!-- 对齐步骤：全屏画布 -->
    <Teleport to="body">
      <div v-if="mobileStep === 1 && imageUrl" class="align-fullscreen">
        <header class="align-fullscreen-head sd-panel-wood">
          <button type="button" class="align-back-btn" @click="mobilePrev">←</button>
          <span class="align-fullscreen-title">对齐网格</span>
          <Tag theme="success" size="small">2/3</Tag>
        </header>

        <GridAlignEditor
          ref="gridEditorRef"
          variant="pixel"
          immersive
          :image-url="imageUrl"
          v-model:rows="gridRows"
          v-model:cols="gridCols"
          v-model:cell-width="cellWidth"
          v-model:cell-height="cellHeight"
          v-model:grid-color="gridColor"
        />

        <footer class="align-fullscreen-foot sd-panel">
          <Button class="footer-btn" block variant="outline" theme="info" @click="mobilePrev">
            重新上传
          </Button>
          <Button
            class="footer-btn primary"
            block
            theme="primary"
            :loading="analyzing"
            :disabled="!gridRows || !gridCols || !cellWidth || !cellHeight"
            @click="analyzeAndShowResult"
          >
            开始分析
          </Button>
        </footer>
      </div>
    </Teleport>

    <main class="mobile-main" :class="{ 'is-result': mobileStep >= 2 }">
      <ImageUpload v-if="mobileStep === 0" variant="pixel" @uploaded="onUploaded" />

      <MobileResultView
        v-else-if="mobileStep >= 2"
        :rows="resultRows"
        :cols="resultCols"
        :cells="cells"
        :hidden-colors="hiddenColors"
        :color-visibility="colorVisibility"
        @toggle="onToggleColor"
        @toggle-all="onToggleAll"
      />
    </main>

    <footer v-if="mobileStep !== 1" class="mobile-footer sd-panel">
      <template v-if="mobileStep === 0">
        <p class="footer-tip sd-body sd-text-muted">上传后进入对齐步骤</p>
      </template>

      <template v-else>
        <Button class="footer-btn" block variant="outline" theme="notice" @click="mobileStep = 1">
          返回调整
        </Button>
        <Button class="footer-btn primary" block theme="primary" @click="resetWizard">
          重新开始
        </Button>
      </template>
    </footer>
  </div>

  <!-- 桌面端 -->
  <div v-else class="desktop-app">
    <header class="app-header">
      <h1>拼豆图纸分析器</h1>
      <p class="subtitle">上传图纸 → 设置行列数、格子宽高并对齐网格 → 分析 MARD 221 标准色</p>
    </header>

    <div v-if="!imageUrl" class="desktop-upload">
      <ImageUpload @uploaded="onUploaded" />
    </div>

    <div v-else class="main-layout">
      <section class="panel source-panel">
        <div class="panel-head">
          <h2>对齐网格</h2>
          <el-button size="small" @click="resetWizard">重新上传</el-button>
        </div>
        <GridAlignEditor
          ref="gridEditorRef"
          immersive
          :image-url="imageUrl"
          v-model:rows="gridRows"
          v-model:cols="gridCols"
          v-model:cell-width="cellWidth"
          v-model:cell-height="cellHeight"
          v-model:grid-color="gridColor"
        />
        <div class="panel-actions">
          <el-button
            type="primary"
            :loading="analyzing"
            :disabled="!gridRows || !gridCols || !cellWidth || !cellHeight"
            @click="handleDesktopAnalyze"
          >
            分析颜色
          </el-button>
        </div>
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
.mobile-app {
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);
}

.mobile-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 10px 12px 0;
  padding: 10px 14px;
  gap: 12px;
  flex-shrink: 0;
}

.mobile-title h1 {
  font-size: 13px;
}

.guide-text {
  margin: 0;
  padding: 6px 16px 10px;
  text-align: center;
  flex-shrink: 0;
}

.mobile-main {
  flex: 1;
  min-height: 0;
  padding: 0 12px 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mobile-main.is-result {
  padding: 0 0 8px;
}

.mobile-footer {
  display: flex;
  gap: 10px;
  margin: 0 12px calc(10px + env(safe-area-inset-bottom));
  padding: 10px 12px;
  flex-shrink: 0;
}

.footer-tip {
  flex: 1;
  margin: 0;
  text-align: center;
  line-height: 40px;
}

.footer-btn {
  flex: 1;
}

.source-panel :deep(.grid-align-editor) {
  padding: 0 12px 12px;
  flex: 1;
  min-height: 0;
}

.footer-btn.primary {
  flex: 1.4;
}

/* 对齐全屏层 */
.align-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  background: var(--sd-bg, #f5e6c8);
  padding-bottom: env(safe-area-inset-bottom);
}

.align-fullscreen-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  flex-shrink: 0;
  margin: 0;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
}

.align-back-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  border: 2px solid var(--sd-border, #8b6914);
  background: var(--sd-surface, #fff8ee);
  color: var(--sd-text, #3e2723);
  cursor: pointer;
  box-shadow: 2px 2px 0 0 var(--sd-shadow, #5c4033);
  flex-shrink: 0;
}

.align-fullscreen-title {
  flex: 1;
  font-size: 14px;
  font-weight: 700;
  color: var(--sd-text, #3e2723);
}

.align-fullscreen .grid-align-editor {
  flex: 1;
  min-height: 0;
}

.align-fullscreen-foot {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  flex-shrink: 0;
  margin: 0;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-bottom: none;
}

.mobile-app.is-align-step {
  overflow: hidden;
}

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

.desktop-upload {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.main-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 1.4fr 1fr 260px;
  gap: 16px;
  min-height: 0;
}

.panel {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.source-panel {
  min-height: calc(100vh - 120px);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.panel h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #606266;
}

.panel-head h2 {
  padding: 0;
  border: none;
}

.source-panel :deep(.grid-align-editor) {
  padding: 0 16px;
  flex: 1;
  min-height: 0;
}

.panel-actions {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
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
