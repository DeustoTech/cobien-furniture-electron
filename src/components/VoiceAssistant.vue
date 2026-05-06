<script setup lang="ts">
import { useVoiceAssistant } from '../composables/useVoiceAssistant'
import { defineExpose } from 'vue'

const { isActive, message, step, startAssistant } = useVoiceAssistant()

defineExpose({
  startAssistant
})
</script>

<template>
  <Teleport to="body">
    <div v-if="isActive" class="voice-overlay">
      <div class="voice-card glass-panel">
        <div class="voice-header">
          <img src="/images/voice.png" alt="voz" class="voice-icon" />
          <h2>Asistente CoBien</h2>
        </div>

        <div class="voice-body">
          <div class="status-indicator" :class="step">
            <div v-if="step === 'listening'" class="pulse-ring" />
            <div v-if="step === 'speaking'" class="wave-icon">🔊</div>
            <div v-if="step === 'idle'" class="idle-icon">⏳</div>
          </div>
          <p class="voice-text">{{ message }}</p>
        </div>

        <div class="voice-footer">
          <button class="close-voice-btn" @click="isActive = false">Cancelar</button>
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
  padding: 3rem;
  width: min(600px, 90vw);
  display: flex;
  flex-direction: column;
  gap: 2rem;
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
  font-size: 1.8rem;
  text-align: center;
  color: #111;
  font-weight: 500;
  margin: 0;
  line-height: 1.4;
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

.close-voice-btn {
  width: 100%;
  padding: 1.2rem;
  border-radius: 15px;
  border: none;
  background: rgba(0,0,0,0.05);
  font-size: 1.4rem;
  font-weight: 600;
  color: #666;
  cursor: pointer;
  transition: background 0.2s;
}

.close-voice-btn:hover {
  background: rgba(0,0,0,0.1);
}
</style>
