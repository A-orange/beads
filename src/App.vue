<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Button, Title } from 'animal-island-vue'
import ImageUpload from './components/ImageUpload.vue'
import GridAlignEditor from './components/GridAlignEditor.vue'
import MobileStepHeader from './components/MobileStepHeader.vue'
import MobileResultView from './components/MobileResultView.vue'
import PatternSheetView from './components/PatternSheetView.vue'
import IslandTag from './components/IslandTag.vue'
import IslandDecorations from './components/IslandDecorations.vue'
import SdIcon from './components/SdIcon.vue'
import { IslandMessage } from './utils/islandMessage'
import { analyzeAlignedGrid } from './utils/imageAnalysis'
import type { BeadCell, GridAlignment } from './utils/imageAnalysis'
import type { BeadColor } from './data/beadColor'
import { initPalette, usePaletteState } from './services/paletteService'
import { usePreventKeyboardScroll } from './composables/usePreventKeyboardScroll'
import { mergeBackgroundColors } from './utils/beadColorRoles'

const { activeLabel } = usePaletteState()
usePreventKeyboardScroll()

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
const backgroundColors = ref(new Set<string>())
const gridEditorRef = ref<InstanceType<typeof GridAlignEditor> | null>(null)
const sheetViewRef = ref<InstanceType<typeof PatternSheetView> | null>(null)
const sheetFooterExpanded = ref(true)
const sheetShowGrid = ref(true)
const sheetShowCellLabels = ref(true)
const analysisImageRef = ref<HTMLImageElement | null>(null)
const savedAlignment = ref<GridAlignment | null>(null)
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

function mergeColorVisibility(beadCells: BeadCell[]) {
  const prev = colorVisibility.value
  const map = new Map<string, boolean>()
  for (const cell of beadCells) {
    if (!map.has(cell.color.tag)) {
      map.set(cell.color.tag, prev.get(cell.color.tag) ?? true)
    }
  }
  colorVisibility.value = map
}

function waitForImage(img: HTMLImageElement) {
  if (img.complete && img.naturalWidth) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('图片加载失败'))
  })
}

async function resolveAnalysisImage(): Promise<HTMLImageElement | null> {
  const editorImg = gridEditorRef.value?.imageRef
  if (editorImg?.naturalWidth) return editorImg

  const cached = analysisImageRef.value
  if (!cached) return null
  await waitForImage(cached)
  return cached.naturalWidth ? cached : null
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

async function runAnalyze(options?: { preserveVisibility?: boolean }): Promise<boolean> {
  if (!gridRows.value || !gridCols.value) {
    IslandMessage.warning('请先设置行列数')
    return false
  }
  if (!cellWidth.value || !cellHeight.value) {
    IslandMessage.warning('请先设置格子宽高')
    return false
  }

  analyzing.value = true
  try {
    const img = await resolveAnalysisImage()
    if (!img?.naturalWidth) {
      IslandMessage.warning('图片尚未加载完成')
      return false
    }

    await new Promise((r) => requestAnimationFrame(r))

    const alignment =
      gridEditorRef.value?.getGridAlignment?.() ?? savedAlignment.value
    if (!alignment?.cellWidth || !alignment?.cellHeight) {
      IslandMessage.warning('缺少网格对齐数据')
      return false
    }
    savedAlignment.value = alignment

    const result = analyzeAlignedGrid(img, gridRows.value, gridCols.value, alignment)
    resultRows.value = result.rows
    resultCols.value = result.cols
    cells.value = result.cells
    if (options?.preserveVisibility) mergeColorVisibility(result.cells)
    else initColorVisibility(result.cells)
    backgroundColors.value = mergeBackgroundColors(backgroundColors.value, result.cells)
    return true
  } catch (e) {
    IslandMessage.error('分析失败：' + (e instanceof Error ? e.message : '未知错误'))
    return false
  } finally {
    analyzing.value = false
  }
}

async function analyzeAndShowResult() {
  const ok = await runAnalyze()
  if (ok) {
    mobileStep.value = 2
    IslandMessage.success(`分析完成，共 ${cells.value.length} 颗豆`)
  }
}

function mobilePrev() {
  if (mobileStep.value > 0) mobileStep.value--
}

function completeAndShowSheet() {
  mobileStep.value = 3
}

function backToEdit() {
  mobileStep.value = 2
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
  backgroundColors.value = new Set()
  savedAlignment.value = null
}

function onToggleColor(tag: string, visible: boolean) {
  colorVisibility.value.set(tag, visible)
  colorVisibility.value = new Map(colorVisibility.value)
}

function onToggleBackground(tag: string, isBackground: boolean) {
  const next = new Set(backgroundColors.value)
  if (isBackground) next.add(tag)
  else next.delete(tag)
  backgroundColors.value = next
}

function onReplaceColor(fromTag: string, newColor: BeadColor) {
  if (fromTag === newColor.tag) return

  const prevVisible = colorVisibility.value.get(fromTag) ?? true

  cells.value = cells.value.map((cell) =>
    cell.color.tag === fromTag ? { ...cell, color: newColor } : cell,
  )

  const map = new Map(colorVisibility.value)
  map.delete(fromTag)
  if (!map.has(newColor.tag)) map.set(newColor.tag, prevVisible)
  colorVisibility.value = map

  if (backgroundColors.value.has(fromTag)) {
    const bg = new Set(backgroundColors.value)
    bg.delete(fromTag)
    bg.add(newColor.tag)
    backgroundColors.value = bg
  }
}

function onReplaceCells(
  keys: Array<{ row: number; col: number }>,
  newColor: BeadColor,
) {
  if (keys.length === 0) return
  const keySet = new Set(keys.map((k) => `${k.row}-${k.col}`))
  cells.value = cells.value.map((cell) =>
    keySet.has(`${cell.row}-${cell.col}`) ? { ...cell, color: newColor } : cell,
  )
  const map = new Map(colorVisibility.value)
  if (!map.has(newColor.tag)) map.set(newColor.tag, true)
  colorVisibility.value = map
}

async function onPaletteChange() {
  if (cells.value.length > 0 && imageUrl.value && savedAlignment.value) {
    const ok = await runAnalyze({ preserveVisibility: true })
    if (ok) IslandMessage.success('已按新色卡重新匹配颜色')
  }
}

onMounted(() => {
  initPalette()
})

onUnmounted(() => {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
})
</script>

<template>
  <div class="mobile-app" :class="{ 'is-align-step': mobileStep === 1 }">
    <Teleport to="body">
      <div v-if="mobileStep === 1 && imageUrl" class="align-fullscreen">
        <section class="page-shell">
          <IslandDecorations />
          <GridAlignEditor
            ref="gridEditorRef"
            immersive
            framed
            :image-url="imageUrl"
            v-model:rows="gridRows"
            v-model:cols="gridCols"
            v-model:cell-width="cellWidth"
            v-model:cell-height="cellHeight"
            v-model:grid-color="gridColor"
          />

          <footer class="page-shell-foot">
            <div class="foot-actions">
              <Button class="footer-btn" block type="default" @click="mobilePrev">
                <span class="sd-btn-inner"><SdIcon name="upload" :size="14" />重新上传</span>
              </Button>
              <Button
                class="footer-btn primary"
                block
                type="primary"
                :loading="analyzing"
                :disabled="!gridRows || !gridCols || !cellWidth || !cellHeight"
                @click="analyzeAndShowResult"
              >
                <span class="sd-btn-inner"><SdIcon name="analyze" :size="14" />开始分析</span>
              </Button>
            </div>
          </footer>
        </section>
      </div>
    </Teleport>

    <img
      v-if="imageUrl && mobileStep >= 2"
      ref="analysisImageRef"
      class="analysis-image-cache"
      :src="imageUrl"
      alt=""
      decoding="async"
    />

    <main class="mobile-main">
      <section v-if="mobileStep === 0" class="page-shell">
        <IslandDecorations />
        <header class="page-shell-head">
          <Title color="app-teal" size="middle">拼豆图纸分析</Title>
          <IslandTag color="app-green">{{ activeLabel }}</IslandTag>
        </header>

        <MobileStepHeader framed :current="mobileStep" :steps="WIZARD_STEPS" />

        <div class="page-shell-body">
          <p class="page-shell-guide">{{ mobileGuideText }}</p>
          <ImageUpload framed @uploaded="onUploaded" />
        </div>
      </section>

      <section v-else-if="mobileStep === 2" class="page-shell">
        <IslandDecorations />
        <MobileResultView
          :rows="resultRows"
          :cols="resultCols"
          :cells="cells"
          :hidden-colors="hiddenColors"
          :background-colors="backgroundColors"
          :color-visibility="colorVisibility"
          @toggle="onToggleColor"
          @toggle-background="onToggleBackground"
          @replace-color="onReplaceColor"
          @replace-cells="onReplaceCells"
          @palette-change="onPaletteChange"
        />

        <footer class="page-shell-foot">
          <div class="foot-actions">
            <Button class="footer-btn" block type="default" @click="mobileStep = 1">
              <span class="sd-btn-inner"><SdIcon name="arrow-left" :size="14" />返回调整</span>
            </Button>
            <Button class="footer-btn primary" block type="primary" @click="completeAndShowSheet">
              <span class="sd-btn-inner"><SdIcon name="check" :size="14" />完成</span>
            </Button>
          </div>
        </footer>
      </section>

      <section v-else-if="mobileStep === 3" class="page-shell">
        <IslandDecorations :lottery-offset="false" />
        <header class="page-shell-head">
          <h1 class="sd-heading">拼豆图纸</h1>
          <IslandTag color="app-green">{{ activeLabel }}</IslandTag>
        </header>

        <PatternSheetView
          ref="sheetViewRef"
          framed
          v-model:show-grid="sheetShowGrid"
          v-model:show-cell-labels="sheetShowCellLabels"
          :title="activeLabel"
          :rows="resultRows"
          :cols="resultCols"
          :cells="cells"
          :hidden-colors="hiddenColors"
          :background-colors="backgroundColors"
          @toggle="onToggleColor"
        />

        <footer class="page-shell-foot" :class="{ 'is-collapsed': !sheetFooterExpanded }">
          <button
            type="button"
            class="page-shell-foot-toggle"
            @click="sheetFooterExpanded = !sheetFooterExpanded"
          >
            <span class="page-shell-foot-bar" />
          </button>
          <div v-show="sheetFooterExpanded" class="sheet-foot-body">
            <div class="sheet-tool-row">
              <Button
                class="footer-btn"
                block
                type="default"
                @click="sheetShowGrid = !sheetShowGrid"
              >
                <span class="sd-btn-inner">
                  <SdIcon :name="sheetShowGrid ? 'grid-off' : 'grid'" :size="14" />
                  {{ sheetShowGrid ? '隐藏网格' : '显示网格' }}
                </span>
              </Button>
              <Button
                class="footer-btn"
                block
                type="default"
                @click="sheetShowCellLabels = !sheetShowCellLabels"
              >
                <span class="sd-btn-inner">
                  <SdIcon :name="sheetShowCellLabels ? 'text-off' : 'text'" :size="14" />
                  {{ sheetShowCellLabels ? '隐藏文字' : '显示文字' }}
                </span>
              </Button>
            </div>
            <div class="sheet-tool-row">
              <Button class="footer-btn" block type="default" @click="sheetViewRef?.exportSheet()">
                <span class="sd-btn-inner"><SdIcon name="download" :size="14" />导出</span>
              </Button>
              <Button class="footer-btn" block type="default" @click="backToEdit">
                <span class="sd-btn-inner"><SdIcon name="edit" :size="14" />返回编辑</span>
              </Button>
            </div>
            <Button
              class="footer-btn footer-btn-restart"
              block
              type="primary"
              size="large"
              @click="resetWizard"
            >
              <span class="sd-btn-inner"><SdIcon name="refresh" :size="14" />重新开始</span>
            </Button>
          </div>
        </footer>
      </section>
    </main>
  </div>
</template>

<style scoped>
.mobile-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.mobile-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.foot-actions {
  display: flex;
  gap: 10px;
  width: 100%;
}

.footer-btn {
  flex: 1;
}

.footer-btn.primary {
  flex: 1.4;
}

.align-fullscreen {
  position: fixed;
  top: var(--vv-top, 0px);
  left: var(--vv-left, 0px);
  width: var(--vv-width, 100%);
  height: var(--vv-height, 100dvh);
  z-index: 200;
  display: flex;
  flex-direction: column;
  padding: 5px;
  padding-bottom: calc(5px + env(safe-area-inset-bottom, 0px));
  background: transparent;
  overflow: hidden;
}

.align-fullscreen .page-shell {
  flex: 1;
  min-height: 0;
  margin: 0;
}

.mobile-app.is-align-step {
  overflow: hidden;
}

.analysis-image-cache {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
}

.sheet-foot-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sheet-tool-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.footer-btn-restart {
  width: 100%;
  min-height: var(--sd-touch-min, 44px);
}
</style>
