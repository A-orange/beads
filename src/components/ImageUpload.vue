<script setup lang="ts">
import { ref } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
import { Button } from '@pixelium/web-vue/es'
import type { UploadFile } from 'element-plus'

defineProps<{
  variant?: 'default' | 'pixel'
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

function onPixelFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) handleFile(file)
  input.value = ''
}

function onUploadChange(uploadFile: UploadFile) {
  if (uploadFile.raw) handleFile(uploadFile.raw)
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files[0]
  if (file) handleFile(file)
}
</script>

<template>
  <div class="image-upload" :class="variant === 'pixel' ? 'variant-pixel' : ''">
    <div class="upload-area" @dragover.prevent @drop="onDrop">
      <template v-if="variant === 'pixel'">
        <div class="pixel-upload sd-panel">
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            hidden
            @change="onPixelFileChange"
          />
          <svg class="upload-icon" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="4" y="20" width="24" height="4" fill="currentColor" />
            <rect x="14" y="8" width="4" height="12" fill="currentColor" />
            <rect x="10" y="12" width="4" height="4" fill="currentColor" />
            <rect x="18" y="12" width="4" height="4" fill="currentColor" />
          </svg>
          <p class="upload-title sd-heading">上传拼豆图纸</p>
          <p class="upload-desc sd-body sd-text-muted">支持 JPG、PNG 等常见图片格式</p>
          <Button block theme="primary" size="large" @click="openFilePicker">选择图片</Button>
        </div>
      </template>
      <el-upload
        v-else
        drag
        :auto-upload="false"
        :show-file-list="false"
        accept="image/*"
        @change="onUploadChange"
      >
        <div class="upload-content">
          <el-icon :size="56" color="#409eff"><UploadFilled /></el-icon>
          <p class="upload-title">上传拼豆图纸</p>
          <p class="upload-desc">支持 JPG、PNG 等常见图片格式</p>
        </div>
      </el-upload>
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
}

.upload-area {
  width: 100%;
  padding: 16px;
}

.upload-area :deep(.el-upload),
.upload-area :deep(.el-upload-dragger) {
  width: 100%;
}

.upload-area :deep(.el-upload-dragger) {
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-content {
  text-align: center;
  padding: 12px;
}

.upload-title {
  margin: 16px 0 6px;
  font-size: 17px;
  font-weight: 600;
}

.upload-desc {
  margin: 0;
  font-size: 13px;
  color: #909399;
}

.variant-pixel .upload-area {
  padding: 0;
}

.pixel-upload {
  width: 100%;
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px 20px;
  text-align: center;
}

.upload-icon {
  width: 48px;
  height: 48px;
  color: var(--sd-primary, #5fa044);
}

.variant-pixel .upload-title {
  font-size: 13px;
  margin: 0;
}

.variant-pixel .upload-desc {
  font-size: 12px;
}
</style>
