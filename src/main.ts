import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@pixelium/web-vue/dist/font.css'
import '@pixelium/web-vue/dist/normalize.css'
import './styles/mobile-theme.css'
import './style.css'
import App from './App.vue'

createApp(App).use(ElementPlus).mount('#app')
