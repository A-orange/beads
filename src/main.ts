import { createApp } from 'vue'
import 'animal-island-vue/style'
import './styles/mobile-theme.css'
import './style.css'
import App from './App.vue'
import { removeHostOverlays } from './utils/removeHostOverlays'

removeHostOverlays()
createApp(App).mount('#app')
