<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()

const wakeWordEnabled = ref(true)
const idleTimeout = ref(120) // Default: 2 minutes (120s)

const timeoutOptions = [
  { label: '30s', value: 30 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
  { label: '30 min', value: 1800 },
  { label: 'Never', value: 0 } // 0 means disabled
]

function goBack() {
  router.push('/settings')
}

function loadSettings() {
  const localWake = localStorage.getItem('cobien_wake_word_enabled')
  wakeWordEnabled.value = localWake !== 'false'

  const localTimeout = localStorage.getItem('cobien_idle_timeout')
  if (localTimeout !== null) {
    idleTimeout.value = parseInt(localTimeout, 10)
  } else {
    idleTimeout.value = 120
  }
}

function toggleWakeWord(enabled: boolean) {
  wakeWordEnabled.value = enabled
  localStorage.setItem('cobien_wake_word_enabled', String(enabled))
  window.dispatchEvent(new Event('wake-word-setting-changed'))
}

function selectTimeout(val: number) {
  idleTimeout.value = val
  localStorage.setItem('cobien_idle_timeout', String(val))
  window.dispatchEvent(new Event('idle-timeout-changed'))
}

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div class="view-container">
    <!-- Header -->
    <div class="header glass-panel">
      <div class="header-left">
        <h1 class="header-title">{{ t('settings.general_title') }}</h1>
      </div>
      <button class="back-btn" @click="goBack">
        <img src="/images/back.png" :alt="t('common.back')" />
      </button>
    </div>

    <!-- Content -->
    <div class="settings-content glass-panel">
      <!-- Wake Word Option -->
      <div class="setting-row">
        <div class="setting-info">
          <h2>{{ t('settings.wake_word') }}</h2>
          <p>{{ t('settings.wake_word_desc') }}</p>
        </div>
        <div class="toggle-switch-container">
          <button
            class="switch-btn"
            :class="{ active: wakeWordEnabled }"
            @click="toggleWakeWord(true)"
          >
            {{ t('common.on') || 'ON' }}
          </button>
          <button
            class="switch-btn"
            :class="{ active: !wakeWordEnabled }"
            @click="toggleWakeWord(false)"
          >
            {{ t('common.off') || 'OFF' }}
          </button>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Sleep Timeout Option -->
      <div class="setting-row vertical">
        <div class="setting-info">
          <h2>{{ t('settings.screen_sleep') }}</h2>
          <p>{{ t('settings.screen_sleep_desc') }}</p>
        </div>
        <div class="options-pills">
          <button
            v-for="opt in timeoutOptions"
            :key="opt.value"
            class="pill-btn"
            :class="{ active: idleTimeout === opt.value }"
            @click="selectTimeout(opt.value)"
          >
            <span v-if="opt.value === 0">{{ t('settings.never') }}</span>
            <span v-else>{{ opt.label }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  height: 100vh;
  padding: 4rem 3rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  box-sizing: border-box;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2rem 2rem;
  border-radius: 20px;
}

.header-title {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0;
  color: #111;
}

.back-btn {
  width: 4.5rem;
  height: 4.5rem;
  background: white;
  border: 2px solid #000;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.back-btn img {
  width: 2.8rem;
  height: 2.8rem;
}

.settings-content {
  flex: 1;
  border-radius: 20px;
  padding: 3rem;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.setting-row.vertical {
  flex-direction: column;
  align-items: flex-start;
  gap: 1.5rem;
}

.setting-info h2 {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  color: #1e293b;
}

.setting-info p {
  font-size: 1.3rem;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

.divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.08);
  width: 100%;
}

/* ON/OFF Switch Styling */
.toggle-switch-container {
  display: flex;
  background: rgba(15, 23, 42, 0.08);
  padding: 0.4rem;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.switch-btn {
  padding: 1rem 2.2rem;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 1.4rem;
  font-weight: 700;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.switch-btn.active {
  background: #0f172a;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
}

/* Timeout Options Styling */
.options-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  width: 100%;
}

.pill-btn {
  flex: 1;
  min-width: 120px;
  padding: 1.4rem 1rem;
  border: 2px solid rgba(15, 23, 42, 0.15);
  background: rgba(255, 255, 255, 0.5);
  color: #334155;
  font-size: 1.4rem;
  font-weight: 700;
  border-radius: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.pill-btn:hover {
  background: rgba(255, 255, 255, 0.85);
  border-color: #0f172a;
  transform: translateY(-2px);
}

.pill-btn.active {
  background: #0f172a;
  border-color: #0f172a;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
}
</style>
