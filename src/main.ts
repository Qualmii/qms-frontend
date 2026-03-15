import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useProfileStore } from './stores/profile'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)

// Инициализируем тему до монтирования приложения
const profileStore = useProfileStore()
profileStore.initializeTheme()

app.mount('#app')
