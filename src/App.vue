<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMqtt } from './composables/useMqtt'
import { startWakeWordDetection, stopWakeWordDetection } from './services/voiceRecognizer'
import { useSettings } from './composables/useSettings'
import VoiceAssistant from './components/VoiceAssistant.vue'
import NotificationOverlay from './components/NotificationOverlay.vue'
// import IdleOverlay from './components/IdleOverlay.vue'

// Register MQTT listener at root level so it works across all screens
useMqtt()

const voiceAssistantRef = ref<any>(null)
const idleTimeout = ref(60)
const { locale } = useI18n()
const { lang } = useSettings()

onMounted(async () => {
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

  try {
    const settings = await (window as any).config.getSettings()
    if (settings && settings.idle_timeout_sec) {
      idleTimeout.value = settings.idle_timeout_sec
    }
  } catch (e) {
    console.error('Error loading settings:', e)
  }

  // Listen for manual trigger (from buttons)
  window.addEventListener('start-voice-assistant', () => {
    voiceAssistantRef.value?.startAssistant()
  })

  // Start background listening for "cobien"
  try {
    startWakeWordDetection(locale.value, () => {
      console.log('[WAKE] UI Triggered by voice')
      window.dispatchEvent(new Event('wake-word-detected'))
      voiceAssistantRef.value?.startAssistant()
    })
  } catch (e) {
    console.error('[WAKE] Error starting background wake word detection:', e)
  }

  // Watch for language changes to restart wake word with new model
  watch(locale, (newLang) => {
    console.log(`[WAKE] Language changed to ${newLang}, restarting wake word detection...`)
    try {
      stopWakeWordDetection()
      startWakeWordDetection(newLang, () => {
        console.log('[WAKE] UI Triggered by voice')
        window.dispatchEvent(new Event('wake-word-detected'))
        voiceAssistantRef.value?.startAssistant()
      })
    } catch (e) {
      console.error('[WAKE] Error restarting wake word detection after language change:', e)
    }
  })
})
</script>


<template>
  <router-view />
  <VoiceAssistant ref="voiceAssistantRef" />
  <NotificationOverlay />
  <!-- <IdleOverlay :timeout-sec="idleTimeout" /> -->
</template>

<style scoped>
</style>
