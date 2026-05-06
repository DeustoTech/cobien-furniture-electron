<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack() {
  router.push('/')
}
</script>

<template>
  <div class="view-container">
    <div class="header">
      <button class="back-button" @click="goBack">
        <span class="icon-placeholder">🔙</span>
        <span>Volver</span>
      </button>
      <div class="title">Pizarra</div>
      <button class="voice-button">
        <img src="/images/voice.png" alt="Voice" class="icon" />
      </button>
    </div>

    <div class="glass-panel board-content">
      <div class="placeholder-text">Pizarra Digital - Próximamente</div>
      <img src="/images/pizarra.png" alt="Pizarra" class="large-icon" />
    </div>
  </div>
</template>

<style scoped>
.view-container {
  height: 100vh;
  padding: 2.5rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 3rem;
  font-weight: 700;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.6);
  padding: 0.5rem 2rem;
  border-radius: 20px;
  backdrop-filter: blur(10px);
}

.back-button, .voice-button {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 2rem;
  font-size: 1.5rem;
  font-weight: 600;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 15px;
  background: white;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s;
}

.back-button:active, .voice-button:active {
  transform: scale(0.95);
}

.icon {
  width: 2rem;
  height: 2rem;
  object-fit: contain;
}

.icon-placeholder {
  font-size: 2rem;
}

.board-content {
  flex: 1;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
}

.placeholder-text {
  font-size: 3rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.large-icon {
  width: 15rem;
  height: 15rem;
  opacity: 0.5;
}
</style>
