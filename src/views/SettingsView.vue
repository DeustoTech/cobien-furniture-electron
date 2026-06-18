<script setup lang="ts">
import { ref, onMounted } from 'vue'

import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ConfirmModal from '../components/ConfirmModal.vue'

const router = useRouter()
const { t } = useI18n()

const version = ref('...')
const deviceId = ref('...')
const showRestartConfirm = ref(false)
const showExitConfirm = ref(false)
const showUninstallConfirm = ref(false)

onMounted(async () => {
  const sys = await (window as any).config.getSystemInfo()
  version.value = sys.version
  deviceId.value = sys.deviceId
})

function goBack() {
  router.push('/')
}

function triggerRestart() {
  showRestartConfirm.value = true
}

function triggerExit() {
  showExitConfirm.value = true
}

function handleRestart() {
  showRestartConfirm.value = false;
  (window as any).config.restartApp()
}

function handleExit() {
  showExitConfirm.value = false;
  (window as any).config.exitApp()
}

function triggerUninstall() {
  showUninstallConfirm.value = true
}

async function handleUninstall() {
  showUninstallConfirm.value = false
  try {
    await (window as any).config.uninstallSystem()
  } catch (err) {
    console.error('Uninstall failed:', err)
  }
}

const settingsButtons = [
  { id: 'lang', icon: '/images/language.png', path: '/settings/language' },
  { id: 'cities', icon: '/images/weather.png', path: '/settings/weather' },
  { id: 'colors', icon: '/images/color.png', path: '#' },
  { id: 'notif', icon: '/svg/notif.svg', path: '#' },
  { id: 'rfid', icon: '/images/card.png', path: '#' },
  { id: 'audio', icon: '/images/audio.png', path: '/settings/audio' },
  { id: 'logs', icon: '/images/logs.png', path: '#' },
  { id: 'parameters', icon: '/images/settings.png', path: '#' },
]
</script>

<template>
  <div class="view-container">
    <!-- Header -->
    <div class="header glass-panel">
      <div class="header-left">
        <h1 class="header-title">{{ t('settings.title') }} <span class="version-tag">v{{ version }}</span></h1>
      </div>

      <div class="header-actions">
        <button class="action-btn reboot" @click="triggerRestart">{{ t('settings.restart') }}</button>
        <button class="action-btn exit" @click="triggerExit">{{ t('settings.exit') }}</button>
        <button class="action-btn uninstall" @click="triggerUninstall">{{ t('settings.uninstall') }}</button>
        <button class="back-btn" @click="goBack">
          <img src="/images/back.png" :alt="t('common.back')" />
        </button>
      </div>
    </div>

    <!-- Grid -->
    <div class="settings-grid glass-panel">
      <button 
        v-for="btn in settingsButtons" 
        :key="btn.id" 
        class="settings-card"
        @click="btn.path !== '#' ? router.push(btn.path) : null"
        :class="{ disabled: btn.path === '#' }"
      >
        <div class="card-icon-wrap">
          <img :src="btn.icon" :alt="btn.id" class="card-icon" />
        </div>
        <div class="card-label">{{ t(`settings.${btn.id}`) }}</div>

      </button>
    </div>
    <ConfirmModal
      v-if="showRestartConfirm"
      :title="t('settings.restart')"
      :message="t('settings.restart_confirm')"
      confirm-class="reboot"
      @confirm="handleRestart"
      @cancel="showRestartConfirm = false"
    />
    <ConfirmModal
      v-if="showExitConfirm"
      :title="t('settings.exit')"
      :message="t('settings.exit_confirm')"
      confirm-class="exit"
      @confirm="handleExit"
      @cancel="showExitConfirm = false"
    />
    <ConfirmModal
      v-if="showUninstallConfirm"
      :title="t('settings.uninstall')"
      :message="t('settings.uninstall_confirm')"
      confirm-class="uninstall"
      @confirm="handleUninstall"
      @cancel="showUninstallConfirm = false"
    />
  </div>
</template>

<style scoped>
.view-container {
  height: 100vh;
  padding: 4rem 3rem 2.5rem;

  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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

.version-tag {
  font-size: 1.2rem;
  font-weight: 600;
  color: #666;
  vertical-align: middle;
  margin-left: 0.5rem;
}

.header-actions {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.action-btn {
  padding: 0.8rem 2rem;
  border-radius: 12px;
  border: none;
  font-size: 1.3rem;
  font-weight: 700;
  color: white;
  cursor: pointer;
}

.action-btn.reboot { background: #e3920c; }
.action-btn.exit { background: #d92e2e; }
.action-btn.uninstall { background: #6b11b1; }

.back-btn {
  width: 5.5rem;
  height: 5.5rem;

  background: white;
  border: 2px solid #000;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.back-btn img {
  width: 3.5rem;
  height: 3.5rem;

}

.settings-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 1.5rem;
  padding: 2rem;
  border-radius: 20px;
}

.settings-card {
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 20px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  cursor: pointer;
}

.settings-card.disabled {
  opacity: 0.6;
  cursor: default;
}

.card-icon-wrap {
  width: clamp(4rem, 6vw, 6rem);
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-icon {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.card-label {
  font-size: clamp(1.2rem, 1.8vw, 1.8rem);
  font-weight: 700;
  color: #111;
  text-align: left;
}

</style>
