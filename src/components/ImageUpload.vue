<script setup lang="ts">
import { ref } from 'vue'
import { Button } from 'animal-island-vue'
import SdIcon from './SdIcon.vue'

defineProps<{
  /** 嵌入 page-shell 时使用简化样式 */
  framed?: boolean
}>()

const emit = defineEmits<{
  uploaded: [url: string, file: File]
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

function openFilePicker() {
  fileInputRef.value?.click()
}

function handleFile(file: File) {
  if (!file.type.startsWith('image/')) return
  emit('uploaded', URL.createObjectURL(file), file)
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) handleFile(file)
  input.value = ''
}
</script>

<template>
  <div class="image-upload" :class="{ framed }">
    <div class="upload-inner" :class="{ framed }">
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        hidden
        @change="onFileChange"
      />
      <div class="upload-icon-wrap" aria-hidden="true">
        <svg class="upload-icon" viewBox="0 0 32 32">
          <rect x="4" y="20" width="24" height="4" fill="currentColor" />
          <rect x="14" y="8" width="4" height="12" fill="currentColor" />
          <rect x="10" y="12" width="4" height="4" fill="currentColor" />
          <rect x="18" y="12" width="4" height="4" fill="currentColor" />
        </svg>
      </div>
      <p class="upload-title sd-heading">上传拼豆图纸</p>
      <p class="upload-desc sd-body sd-text-muted">支持 JPG、PNG 等常见图片格式</p>
      <p class="upload-tip sd-text-muted">上传后可在下一步对齐网格并匹配色号</p>
      <Button block type="primary" size="large" @click="openFilePicker">
        <span class="sd-btn-inner"><SdIcon name="image" :size="16" />选择图片</span>
      </Button>
    </div>
  </div>
</template>

<style scoped>
.image-upload {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 4px 0;
}

.image-upload.framed {
  padding: 16px 12px;
  align-items: stretch;
}

.upload-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 28px 20px 24px;
  text-align: center;
  min-height: 260px;
  justify-content: center;
  background: var(--sd-surface);
  border: 2px dashed var(--sd-border-light);
  border-radius: 20px;
  box-shadow: inset 0 2px 4px rgba(114, 93, 66, 0.08);
}

.upload-inner.framed {
  flex: 1;
  min-height: 0;
  justify-content: center;
}

.upload-icon-wrap {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--animal-primary-color-bg, #e6f9f6);
  border: 2px solid var(--sd-primary-light);
  border-radius: 18px;
}

.upload-icon {
  width: 40px;
  height: 40px;
  color: var(--sd-primary);
}

.upload-title {
  font-size: 14px;
}

.upload-desc {
  font-size: 12px;
}

.upload-tip {
  margin: 0;
  font-size: 11px;
  font-family: var(--sd-font-body);
  line-height: 1.5;
}
</style>
