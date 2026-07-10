import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
// base: './' — AxureShow 等托管在子路径下，绝对路径 /assets 会 404 导致白屏
export default defineConfig({
  base: './',
  plugins: [vue()],
})
