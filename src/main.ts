import { createApp } from 'vue'
import '@pixelium/web-vue/dist/font.css'
import '@pixelium/web-vue/dist/normalize.css'
import './styles/mobile-theme.css'
import './style.css'
import './styles/button-overrides.css'
import App from './App.vue'
import { removeHostOverlays } from './utils/removeHostOverlays'

removeHostOverlays()
createApp(App).mount('#app')

