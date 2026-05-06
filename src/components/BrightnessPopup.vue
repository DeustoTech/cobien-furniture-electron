<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  initialValue?: number
}>()

const emit = defineEmits(['close'])

const brightness = ref(props.initialValue ?? 70)
const isActive = ref(false)

async function updateBrightness() {
  await (window as any).config.adjustBrightness(brightness.value / 100)
}

function close() {
  isActive.value = false
  setTimeout(() => emit('close'), 300)
}

onMounted(() => {
  isActive.value = true
})
</script>

<template>
  <div class="popup-overlay" :class="{ active: isActive }" @click.self="close">
    <div class="popup-card glass-panel" :class="{ active: isActive }">
      <div class="popup-header">
        <div class="header-title">
          <img src="/images/brightness_ctrl.png" class="header-icon" />
          <h2>Brillo</h2>
        </div>
        <button class="close-btn" @click="close">✕</button>
      </div>

      <div class="popup-body">
        <div class="control-group">
          <div class="value-display">{{ brightness }}%</div>
          <input 
            type="range" 
            v-model.number="brightness" 
            min="10" max="100" step="10" 
            @input="updateBrightness"
            class="styled-slider"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0);
  backdrop-filter: blur(0px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 11000;
  transition: all 0.3s ease;
  pointer-events: none;
}

.popup-overlay.active {
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(6px);
  pointer-events: all;
}

.popup-card {
  width: 400px;
  background: white;
  border-radius: 32px;
  padding: 2rem;
  box-shadow: 0 30px 80px rgba(0,0,0,0.3);
  transform: translateY(40px) scale(0.92);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  border: 1.5px solid rgba(0,0,0,0.1);
}

.popup-card.active {
  transform: translateY(0) scale(1);
  opacity: 1;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-title h2 {
  font-size: 1.8rem;
  font-weight: 800;
  margin: 0;
  color: #111;
}

.header-icon {
  width: 2.5rem;
  height: 2.5rem;
  object-fit: contain;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #999;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #333;
}

.popup-body {
  padding: 1rem 0;
}

.control-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

.value-display {
  font-size: 3rem;
  font-weight: 800;
  color: #000;
}

.styled-slider {
  -webkit-appearance: none;
  width: 100%;
  height: 14px;
  background: #f0f0f0;
  border-radius: 7px;
  outline: none;
}

.styled-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 32px;
  height: 32px;
  background: #000;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  border: 2px solid white;
}
</style>
