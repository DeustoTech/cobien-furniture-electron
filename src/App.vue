<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMqtt } from './composables/useMqtt'
import VoiceAssistant from './components/VoiceAssistant.vue'
import IdleOverlay from './components/IdleOverlay.vue'

// Register MQTT listener at root level so it works across all screens
useMqtt()

const voiceAssistantRef = ref<any>(null)
const idleTimeout = ref(60)

onMounted(async () => {
  try {
    const settings = await (window as any).config.getSettings()
    if (settings.idle_timeout_sec) {
      idleTimeout.value = settings.idle_timeout_sec
    }
  } catch (e) {}

  window.addEventListener('start-voice-assistant', () => {
    voiceAssistantRef.value?.startAssistant()
  })

  // Wake word detection
  (window as any).config.onWakeWordDetected(() => {
    console.log('[WAKE] UI Triggered by voice')
    voiceAssistantRef.value?.startAssistant()
  })
})

</script>

<template>
  <router-view />
  <VoiceAssistant ref="voiceAssistantRef" />
  <IdleOverlay :timeout-sec="idleTimeout" />
</template>

<style scoped>
</style>
