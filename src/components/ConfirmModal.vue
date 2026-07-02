<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmClass?: string
  thirdText?: string
  thirdClass?: string
}>(), {
  confirmText: 'Aceptar',
  cancelText: 'Cancelar',
  confirmClass: 'primary',
  thirdText: '',
  thirdClass: 'secondary'
})

const emit = defineEmits(['confirm', 'cancel', 'third'])

const isActive = ref(false)

function onCancel() {
  isActive.value = false
  setTimeout(() => emit('cancel'), 300)
}

function onConfirm() {
  isActive.value = false
  setTimeout(() => emit('confirm'), 300)
}

function onThird() {
  isActive.value = false
  setTimeout(() => emit('third'), 300)
}

onMounted(() => {
  isActive.value = true
})
</script>

<template>
  <div class="popup-overlay" :class="{ active: isActive }" @click.self="onCancel">
    <div class="popup-card glass-panel" :class="{ active: isActive }">
      <div class="popup-header">
        <h2 class="modal-title">{{ title }}</h2>
      </div>

      <div class="popup-body">
        <p class="modal-message">{{ message }}</p>
      </div>

      <div class="popup-actions">
        <button class="btn-large cancel-btn" @click="onCancel">{{ cancelText }}</button>
        <button v-if="thirdText" class="btn-large confirm-btn" :class="thirdClass" @click="onThird">{{ thirdText }}</button>
        <button class="btn-large confirm-btn" :class="confirmClass" @click="onConfirm">{{ confirmText }}</button>
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
  z-index: 12000;
  transition: all 0.3s ease;
  pointer-events: none;
}

.popup-overlay.active {
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(6px);
  pointer-events: all;
}

.popup-card {
  width: 500px;
  max-width: 90vw;
  background: white;
  border-radius: 32px;
  padding: 2.5rem;
  box-shadow: 0 30px 80px rgba(0,0,0,0.3);
  transform: translateY(40px) scale(0.92);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  border: 1.5px solid rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.popup-card.active {
  transform: translateY(0) scale(1);
  opacity: 1;
}

.modal-title {
  font-size: 2.2rem;
  font-weight: 850;
  margin: 0;
  color: #111;
  text-align: center;
}

.modal-message {
  font-size: 1.4rem;
  font-weight: 600;
  color: #555;
  text-align: center;
  line-height: 1.6;
  margin: 0;
}

.popup-actions {
  display: flex;
  gap: 1.5rem;
  margin-top: 1rem;
}

.btn-large {
  flex: 1;
  height: 5.5rem;
  border-radius: 18px;
  font-size: 1.4rem;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border: none;
}

.btn-large:active {
  transform: scale(0.96);
}

.cancel-btn {
  background: #f0f0f0;
  color: #444;
}

.cancel-btn:hover {
  background: #e5e5e5;
}

.confirm-btn.primary {
  background: #3b82f6;
  color: white;
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.25);
}

.confirm-btn.reboot {
  background: #e3920c;
  color: white;
  box-shadow: 0 8px 20px rgba(227, 146, 12, 0.25);
}

.confirm-btn.exit {
  background: #d92e2e;
  color: white;
  box-shadow: 0 8px 20px rgba(217, 46, 46, 0.25);
}

.confirm-btn.delete {
  background: #d92e2e;
  color: white;
  box-shadow: 0 8px 20px rgba(217, 46, 46, 0.25);
}

.confirm-btn.secondary {
  background: #6c757d;
  color: white;
  box-shadow: 0 8px 20px rgba(108, 117, 125, 0.25);
}
</style>
