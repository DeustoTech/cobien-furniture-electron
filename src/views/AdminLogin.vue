<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()

const pin = ref('')
const error = ref(false)
const CORRECT_PIN = '1234' // This could be configurable later

function addDigit(d: string) {
  if (pin.value.length < 4) {
    pin.value += d
    error.value = false
  }
}

function clear() {
  pin.value = ''
}

function back() {
  router.push('/')
}

async function verify() {
  if (pin.value === CORRECT_PIN) {
    router.push('/settings')
  } else {
    error.value = true
    pin.value = ''
    // Subtle shake animation would be nice
  }
}
</script>

<template>
  <div class="view-container login-bg">
    <div class="login-card glass-panel" :class="{ error }">
      <div class="login-header">
        <img src="/images/settings.png" class="lock-icon" />
        <h2>{{ t('settings.title') }}</h2>
        <p>{{ t('settings.enter_pin') }}</p>
      </div>

      <div class="pin-display">
        <div v-for="i in 4" :key="i" class="pin-dot" :class="{ filled: pin.length >= i }"></div>
      </div>

      <div class="keypad">
        <button v-for="n in 9" :key="n" @click="addDigit(n.toString())" class="key">{{ n }}</button>
        <button @click="clear" class="key clear">C</button>
        <button @click="addDigit('0')" class="key">0</button>
        <button @click="verify" class="key enter" :disabled="pin.length < 4">✓</button>
      </div>

      <button class="cancel-btn" @click="back">{{ t('common.cancel') }}</button>

    </div>
  </div>
</template>

<style scoped>
.view-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
}

.login-card {
  width: 500px;

  padding: 3rem;
  border-radius: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  text-align: center;
}

.login-card.error {
  animation: shake 0.4s ease-in-out;
  border-color: rgba(239, 68, 68, 0.5);
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}

.lock-icon {
  width: 4rem;
  margin-bottom: 1rem;
}

.pin-display {
  display: flex;
  gap: 1.5rem;
  margin: 1rem 0;
}

.pin-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #ccc;
  transition: all 0.2s;
}

.pin-dot.filled {
  background: #000;
  border-color: #000;
  transform: scale(1.1);
}

.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.2rem;
  width: 100%;
}

.key {
  height: 85px;

  background: white;
  border: 1.5px solid #eee;
  border-radius: 20px;
  font-size: 1.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.key:active {
  background: #f0f0f0;
  transform: scale(0.95);
}

.key.clear { color: #ef4444; }
.key.enter { 
  background: #000; 
  color: white; 
  border-color: #000;
}
.key.enter:disabled {
  opacity: 0.3;
  cursor: default;
}

.cancel-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  font-weight: 600;
  color: #666;
  cursor: pointer;
  margin-top: 1rem;
}
</style>
