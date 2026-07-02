import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import i18n from './i18n'

const app = createApp(App)

// Global error handler: prevent unhandled Vue errors from crashing the renderer
app.config.errorHandler = (err, _instance, info) => {
  console.error(`[Vue Error] ${info}:`, err)
}

app.use(router)
app.use(i18n)
app.mount('#app')
