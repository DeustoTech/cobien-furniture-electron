<script setup lang="ts">
import { useVoiceAssistant } from '../composables/useVoiceAssistant'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { isActive, message, step, audioLevel, startAssistant, cancelAssistant } = useVoiceAssistant()



defineExpose({
  startAssistant
})
</script>

<template>
  <Teleport to="body">
    <div v-if="isActive" class="voice-overlay">
      <div class="voice-card glass-panel">
        <div class="voice-header">
          <img src="/svg/voice.svg" alt="voz" class="voice-icon" />
          <h2>{{ t('assistant.title') }}</h2>

        </div>

        <div class="voice-body">
          <div class="status-indicator" :class="step">
            <div v-if="step === 'listening'" class="visualizer">
              <div v-for="i in 5" :key="i" class="bar" :style="{ transform: `scaleY(${0.2 + audioLevel * 2})` }"></div>
            </div>
            <div v-if="step === 'speaking'" class="wave-icon">🔊</div>
            <div v-if="step === 'idle'" class="idle-icon">⏳</div>
          </div>
          <div class="transcription-container">
            <p class="voice-text">{{ message }}</p>
          </div>
        </div>


        <div class="voice-footer">
          <button class="close-voice-btn" @click="cancelAssistant">{{ t('common.cancel') }}</button>

        </div>
      </div>
    </div>
  </Teleport>
</template>


<style scoped>
.voice-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(8px);
}

.voice-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 30px;
  padding: 4rem;
  width: min(800px, 95vw);
  display: flex;
  flex-direction: column;
  gap: 3rem;
  box-shadow: 0 40px 100px rgba(0,0,0,0.5);
  animation: slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes slideUp {
  from { transform: translateY(50px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.voice-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  border-bottom: 1px solid rgba(0,0,0,0.1);
  padding-bottom: 1.5rem;
}

.voice-header h2 {
  font-size: 2.2rem;
  font-weight: 800;
  margin: 0;
  color: #333;
}

.voice-icon {
  width: 4rem;
  height: 4rem;
}

.voice-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  min-height: 150px;
  justify-content: center;
}

.voice-text {
  font-size: 2.5rem;
  text-align: center;
  color: #000;
  font-weight: 700;
  margin: 0;
  line-height: 1.3;
}

.status-indicator {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pulse-ring {
  width: 60px;
  height: 60px;
  border: 6px solid var(--accent-blue);
  border-radius: 50%;
  animation: pulse 1.2s ease-out infinite;
}

@keyframes pulse {
  0% { transform: scale(0.7); opacity: 1; }
  100% { transform: scale(1.6); opacity: 0; }
}

.wave-icon {
  font-size: 4rem;
  animation: bounce 0.5s ease-in-out infinite alternate;
}

@keyframes bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-10px); }
}

.visualizer {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 60px;
}

.bar {
  width: 12px;
  height: 100%;
  background: #007aff;
  border-radius: 6px;
  transition: transform 0.1s ease;
  transform-origin: center;
}

.transcription-container {
  background: rgba(0,0,0,0.03);
  padding: 1.5rem 2rem;
  border-radius: 20px;
  width: 100%;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}


.close-voice-btn {
  width: 100%;
  padding: 2.5rem;
  border-radius: 20px;
  border: 4px solid #000;
  background: #fff;
  font-size: 2.4rem;
  font-weight: 900;
  color: #000;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.close-voice-btn:hover {
  background: #000;
  color: #fff;
}
</style>
