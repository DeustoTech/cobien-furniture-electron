<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack() {
  router.push('/')
}
</script>

<template>
  <div class="call-container">
    <button class="exit-button" @click="goBack">
      <span class="icon-placeholder">✖️</span>
      <span>Finalizar Llamada</span>
    </button>
    <div class="webview-placeholder">
      <!-- In Electron, this could be a <webview src="https://jitsi..."></webview> -->
      <div class="video-mock">
        <img src="/images/videollamada.png" alt="Videollamada" class="call-icon" />
        <div class="status-text">Conectando con María...</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.call-container {
  height: 100vh;
  width: 100vw;
  background: #000;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.exit-button {
  position: absolute;
  top: 2rem;
  left: 2rem;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 2rem;
  font-size: 1.5rem;
  font-weight: 600;
  color: white;
  background: rgba(255, 0, 0, 0.7);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 15px;
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: all 0.2s;
}

.exit-button:active {
  transform: scale(0.95);
  background: rgba(255, 0, 0, 0.9);
}

.icon-placeholder {
  font-size: 2rem;
}

.webview-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-mock {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

.call-icon {
  width: 10rem;
  height: 10rem;
  filter: invert(1);
  animation: pulse 2s infinite;
}

.status-text {
  font-size: 2.5rem;
  color: white;
  font-weight: 500;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
