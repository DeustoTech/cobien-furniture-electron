<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useMqtt } from './composables/useMqtt'
import { startWakeWordDetection, stopWakeWordDetection } from './services/voiceRecognizer'
import { useSettings } from './composables/useSettings'
import VoiceAssistant from './components/VoiceAssistant.vue'
import NotificationOverlay from './components/NotificationOverlay.vue'
import IdleOverlay from './components/IdleOverlay.vue'
import EmotionPromptOverlay from './components/EmotionPromptOverlay.vue'

// Register MQTT listener at root level so it works across all screens
useMqtt()

const voiceAssistantRef = ref<any>(null)
const idleTimeout = ref(60)
const { t, locale } = useI18n()
const { lang } = useSettings()

const router = useRouter()
const route = useRoute()

const isOffline = ref(false) // Start as false to prevent blocking screens on startup
const countdown = ref(5)
let countdownInterval: any = null
let networkInterval: any = null

const showEmotionPrompt = ref(false)
let emotionCheckInterval: any = null
const lastEmotionPromptDate = ref('')

const checkRealOnlineStatus = async () => {
  try {
    const online = await (window as any).config.isOnline()
    isOffline.value = !online
    if (online) {
      if (countdownInterval) {
        clearInterval(countdownInterval)
        countdownInterval = null
      }
    } else {
      startRedirectCountdown()
    }
  } catch (e) {
    console.error('[NETWORK] Failed to check online status via IPC, falling back to navigator.onLine:', e)
    isOffline.value = !navigator.onLine
    if (navigator.onLine) {
      if (countdownInterval) {
        clearInterval(countdownInterval)
        countdownInterval = null
      }
    } else {
      startRedirectCountdown()
    }
  }
}

const handleOnline = async () => {
  console.log('[NETWORK] Browser event: online')
  await checkRealOnlineStatus()
}

const handleOffline = async () => {
  console.log('[NETWORK] Browser event: offline')
  await checkRealOnlineStatus()
}

function startRedirectCountdown() {
  if (route.path === '/settings/wifi') return
  if (countdownInterval) clearInterval(countdownInterval)
  
  countdown.value = 5
  countdownInterval = setInterval(() => {
    if (route.path === '/settings/wifi' || !isOffline.value) {
      if (countdownInterval) {
        clearInterval(countdownInterval)
        countdownInterval = null
      }
      return
    }
    countdown.value--
    if (countdown.value <= 0) {
      if (countdownInterval) {
        clearInterval(countdownInterval)
        countdownInterval = null
      }
      goToWifi()
    }
  }, 1000)
}

function goToWifi() {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
  router.push('/settings/wifi')
}

// Watch route to trigger countdown if we navigate away from wifi settings while offline
watch(
  () => route.path,
  (newPath) => {
    if (isOffline.value && newPath !== '/settings/wifi') {
      startRedirectCountdown()
    } else {
      if (countdownInterval) {
        clearInterval(countdownInterval)
        countdownInterval = null
      }
    }
  }
)

onMounted(async () => {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Verify initial network connectivity using the backend check
  await checkRealOnlineStatus()

  // Periodically check connection every 15 seconds
  networkInterval = setInterval(checkRealOnlineStatus, 15000)

  try {
    const sysInfo = await (window as any).config.getSystemInfo()
    if (sysInfo && sysInfo.defaultLanguage) {
      if (!localStorage.getItem('cobien_lang')) {
        const defaultLang = sysInfo.defaultLanguage
        console.log(`[SETTINGS] Using default language from env: ${defaultLang}`)
        lang.value = defaultLang
      }
    }
  } catch (e) {
    console.error('Error loading default language:', e)
  }

  const handleIdleTimeoutChange = () => {
    const localT = localStorage.getItem('cobien_idle_timeout')
    if (localT !== null) {
      idleTimeout.value = parseInt(localT, 10)
    }
  }

  const localTimeout = localStorage.getItem('cobien_idle_timeout')
  if (localTimeout !== null) {
    idleTimeout.value = parseInt(localTimeout, 10)
  } else {
    try {
      const settings = await (window as any).config.getSettings()
      if (settings && settings.idle_timeout_sec) {
        idleTimeout.value = settings.idle_timeout_sec
      }
    } catch (e) {
      console.error('Error loading settings:', e)
    }
  }

  window.addEventListener('idle-timeout-changed', handleIdleTimeoutChange)

  // Listen for manual trigger (from buttons)
  window.addEventListener('start-voice-assistant', () => {
    voiceAssistantRef.value?.startAssistant()
  })

  const startWakeWithCheck = () => {
    try {
      stopWakeWordDetection()
      const enabled = localStorage.getItem('cobien_wake_word_enabled') !== 'false'
      if (enabled) {
        console.log('[WAKE] Starting background wake word detection...')
        startWakeWordDetection(locale.value, () => {
          console.log('[WAKE] UI Triggered by voice')
          window.dispatchEvent(new Event('wake-word-detected'))
          voiceAssistantRef.value?.startAssistant()
        })
      } else {
        console.log('[WAKE] Wake word detection is disabled by user settings')
      }
    } catch (e) {
      console.error('[WAKE] Error managing wake word detection:', e)
    }
  }

  // Start background listening for "cobien"
  startWakeWithCheck()

  // Watch for language changes to restart wake word with new model
  watch(locale, () => {
    console.log(`[WAKE] Language changed, restarting check...`)
    startWakeWithCheck()
  })

  // Listen for setting updates
  window.addEventListener('wake-word-setting-changed', startWakeWithCheck)

  onBeforeUnmount(() => {
    window.removeEventListener('wake-word-setting-changed', startWakeWithCheck)
  })

  window.addEventListener('idle-timeout-changed', handleIdleTimeoutChange)
  window.addEventListener('reopen-emotion-prompt', () => {
    showEmotionPrompt.value = true
  })
  startEmotionCron()
})

function startEmotionCron() {
  if (emotionCheckInterval) clearInterval(emotionCheckInterval)
  emotionCheckInterval = setInterval(async () => {
    try {
      const settings = await (window as any).config.getSettings()
      if (settings && settings.emotionPromptTime && settings.emotionPromptTime !== 'none') {
        const now = new Date()
        const hh = String(now.getHours()).padStart(2, '0')
        const mm = String(now.getMinutes()).padStart(2, '0')
        const currentTime = `${hh}:${mm}`
        const todayDate = now.toISOString().split('T')[0]

        if (currentTime === settings.emotionPromptTime && lastEmotionPromptDate.value !== todayDate) {
          lastEmotionPromptDate.value = todayDate
          showEmotionPrompt.value = true
        }
      }
    } catch (e) {
      console.error('Emotion cron error:', e)
    }
  }, 60000)
}

function handleEmotionMissed() {
  showEmotionPrompt.value = false
  window.dispatchEvent(new CustomEvent('new-notification', {
    detail: {
      type: 'missed_emotion',
      sender: 'CoBien',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }))
}

function handleEmotionAnswered() {
  showEmotionPrompt.value = false
}

onBeforeUnmount(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
  if (networkInterval) {
    clearInterval(networkInterval)
    networkInterval = null
  }
})
</script>


<template>
  <router-view />
  <VoiceAssistant ref="voiceAssistantRef" />
  <NotificationOverlay />
  <IdleOverlay v-if="idleTimeout > 0" :timeout-sec="idleTimeout" />

  <EmotionPromptOverlay
    :is-active="showEmotionPrompt"
    @missed="handleEmotionMissed"
    @answered="handleEmotionAnswered"
    @close="showEmotionPrompt = false"
  />

  <!-- Premium Glassmorphic Offline Warning Overlay -->
  <div v-if="isOffline && route.path !== '/settings/wifi'" class="offline-overlay">
    <div class="offline-card glass-panel">
      <div class="offline-icon-container">
        <svg class="offline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.5M5 12.5a10.94 10.94 0 015.83-2.84M8.5 16.5a5 5 0 017 0M12 20h.01" />
        </svg>
      </div>
      <h2 class="offline-title">{{ t('offline.title') }}</h2>
      <p class="offline-text">{{ t('offline.message') }}</p>
      
      <div class="offline-status">
        <span class="countdown-tag">{{ t('offline.redirecting', { seconds: countdown }) }}</span>
      </div>
      
      <button class="wifi-redirect-btn" @click="goToWifi">
        {{ t('offline.redirect_btn') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.offline-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  animation: fadeIn 0.3s ease-out;
}

.offline-card {
  width: 90%;
  max-width: 520px;
  padding: 3rem 2.5rem;
  border-radius: var(--radius-lg, 28px);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1.8rem;
  background: rgba(255, 255, 255, 0.82);
  border: 2px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.18);
  animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.offline-icon-container {
  width: 90px;
  height: 90px;
  background: hsla(350, 100%, 96%, 0.95);
  border: 1px solid hsla(350, 100%, 90%, 0.85);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: hsl(350, 89%, 60%);
  margin-bottom: 0.5rem;
}

.offline-icon {
  width: 44px;
  height: 44px;
}

.offline-title {
  font-size: 2.4rem;
  font-weight: 800;
  color: #0f172a;
}

.offline-text {
  font-size: 1.6rem;
  color: #475569;
  line-height: 1.5;
  font-weight: 500;
}

.offline-status {
  margin: 0.5rem 0;
}

.countdown-tag {
  background: hsla(215, 15%, 90%, 0.75);
  color: #334155;
  padding: 0.6rem 1.6rem;
  border-radius: 100px;
  font-size: 1.3rem;
  font-weight: 700;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.wifi-redirect-btn {
  width: 100%;
  padding: 1.4rem 2rem;
  background: #0f172a;
  color: white;
  border: none;
  border-radius: 16px;
  font-size: 1.6rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
  transition: all 0.2s ease;
}

.wifi-redirect-btn:active {
  transform: scale(0.97);
  background: #1e293b;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(30px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
</style>

