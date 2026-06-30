<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()

interface NotificationProfile {
  group: number
  intensity: number
  color: string
  mode: string
  ringtone: string
}

const profiles = ref<Record<string, NotificationProfile>>({
  videollamada: { group: 1, intensity: 255, color: '#00FF00', mode: 'ON', ringtone: '' },
  nuevo_evento: { group: 2, intensity: 255, color: '#FF0000', mode: 'ON', ringtone: '' },
  nueva_foto: { group: 3, intensity: 255, color: '#0000FF', mode: 'BLINK', ringtone: '' }
})

const ringtones = ref<string[]>([])
const isLoading = ref(true)
const saveSuccess = ref(false)

const playingRingtone = ref<string | null>(null)
let audioPreview: HTMLAudioElement | null = null

let ledTimeout: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  try {
    const loaded = await (window as any).config.getNotifications()
    if (loaded) {
      if (loaded.videollamada) {
        profiles.value.videollamada = { ...profiles.value.videollamada, ...loaded.videollamada }
      }
      if (loaded.nuevo_evento) {
        profiles.value.nuevo_evento = { ...profiles.value.nuevo_evento, ...loaded.nuevo_evento }
      }
      if (loaded.nueva_foto) {
        profiles.value.nueva_foto = { ...profiles.value.nueva_foto, ...loaded.nueva_foto }
      }
    }
    ringtones.value = await (window as any).config.getRingtones()
  } catch (e) {
    console.error('Failed to load notifications config:', e)
  } finally {
    isLoading.value = false
  }
})

onUnmounted(() => {
  stopPreview()
  if (ledTimeout) clearTimeout(ledTimeout)
})

function goBack() {
  router.push('/settings')
}

function togglePreview(ringtoneName: string) {
  if (!ringtoneName) return

  if (playingRingtone.value === ringtoneName) {
    stopPreview()
    return
  }

  stopPreview()

  try {
    audioPreview = new Audio(`/audio/ringtones/${ringtoneName}`)
    playingRingtone.value = ringtoneName
    audioPreview.play().catch(e => {
      console.error('Audio preview playback failed:', e)
      stopPreview()
    })
    audioPreview.onended = () => {
      stopPreview()
    }
  } catch (err) {
    console.error('Error playing audio preview:', err)
    stopPreview()
  }
}

function stopPreview() {
  if (audioPreview) {
    try {
      audioPreview.pause()
      audioPreview.removeAttribute('src')
      audioPreview.load()
    } catch (e) {}
    audioPreview = null
  }
  playingRingtone.value = null
}

async function handleSaveSingle(type: string) {
  try {
    const rawPayload = JSON.parse(JSON.stringify(profiles.value))
    const success = await (window as any).config.saveNotifications(rawPayload)
    if (success) {
      triggerSuccessFlash()
      // Trigger LED config for testing
      await (window as any).config.triggerNotificationLed(type)

      // Turn off after 5 seconds
      if (ledTimeout) clearTimeout(ledTimeout)
      ledTimeout = setTimeout(async () => {
        await (window as any).config.turnOffNotificationLed()
      }, 5000)
    }
  } catch (e) {
    console.error(`Failed to save notification profile ${type}:`, e)
  }
}

async function handleSaveAll() {
  try {
    const rawPayload = JSON.parse(JSON.stringify(profiles.value))
    const success = await (window as any).config.saveNotifications(rawPayload)
    if (success) {
      triggerSuccessFlash()
    }
  } catch (e) {
    console.error('Failed to save notifications configuration:', e)
  }
}

function triggerSuccessFlash() {
  saveSuccess.value = true
  setTimeout(() => {
    saveSuccess.value = false
  }, 2500)
}

async function handleSimulate(type: string) {
  try {
    await (window as any).config.simulateNotification(type)
  } catch (e) {
    console.error(`Failed to simulate notification ${type}:`, e)
  }
}
</script>

<template>
  <div class="view-container">
    <!-- Header -->
    <div class="header glass-panel">
      <div class="header-left">
        <h1 class="header-title">{{ t('settings.notifications_title') }}</h1>
      </div>
      <button class="back-btn" @click="goBack">
        <img src="/images/back.png" :alt="t('common.back')" />
      </button>
    </div>

    <!-- Main Content -->
    <div class="content-area" v-if="!isLoading">
      <div class="cards-grid">
        <!-- videollamada -->
        <div class="config-card glass-panel call-card">
          <div class="card-header">
            <span class="header-icon">📞</span>
            <h2>{{ t('settings.notifications_videollamada') }}</h2>
          </div>

          <div class="control-group">
            <label>{{ t('settings.color_label') }}</label>
            <div class="color-picker-wrapper">
              <div class="color-preview" :style="{ backgroundColor: profiles.videollamada.color }"></div>
              <input type="color" v-model="profiles.videollamada.color" class="color-input" />
              <input type="text" v-model="profiles.videollamada.color" class="hex-text" maxlength="7" />
            </div>
          </div>

          <div class="control-group">
            <label>{{ t('settings.mode_label') }}</label>
            <select v-model="profiles.videollamada.mode" class="select-input">
              <option value="ON">{{ t('settings.modes.on') }}</option>
              <option value="OFF">{{ t('settings.modes.off') }}</option>
              <option value="BLINK">{{ t('settings.modes.blink') }}</option>
              <option value="FADING_BLINK">{{ t('settings.modes.fading_blink') }}</option>
            </select>
          </div>

          <div class="control-group">
            <div class="slider-label-row">
              <label>{{ t('settings.intensity_label') }}</label>
              <span class="value-badge">{{ profiles.videollamada.intensity }}</span>
            </div>
            <input type="range" min="0" max="255" step="1" v-model.number="profiles.videollamada.intensity" class="range-slider" />
          </div>

          <div class="control-group">
            <label>{{ t('settings.ringtone_label') }}</label>
            <div class="ringtone-picker-row">
              <select v-model="profiles.videollamada.ringtone" class="select-input ringtone-select">
                <option value="">{{ t('settings.ringtone_none') }}</option>
                <option v-for="ring in ringtones" :key="ring" :value="ring">{{ ring }}</option>
              </select>
              <button 
                class="play-preview-btn" 
                :disabled="!profiles.videollamada.ringtone"
                @click="togglePreview(profiles.videollamada.ringtone)"
                :class="{ playing: playingRingtone === profiles.videollamada.ringtone }"
              >
                <span v-if="playingRingtone === profiles.videollamada.ringtone">⏹️</span>
                <span v-else>▶️</span>
              </button>
            </div>
          </div>

          <div class="card-actions">
            <button class="action-btn simulate" @click="handleSimulate('videollamada')">
              {{ t('settings.simulate_notif') }}
            </button>
            <button class="action-btn update" @click="handleSaveSingle('videollamada')">
              {{ t('settings.update_notif') }}
            </button>
          </div>
        </div>

        <!-- nuevo_evento -->
        <div class="config-card glass-panel event-card">
          <div class="card-header">
            <span class="header-icon">📅</span>
            <h2>{{ t('settings.notifications_nuevo_evento') }}</h2>
          </div>

          <div class="control-group">
            <label>{{ t('settings.color_label') }}</label>
            <div class="color-picker-wrapper">
              <div class="color-preview" :style="{ backgroundColor: profiles.nuevo_evento.color }"></div>
              <input type="color" v-model="profiles.nuevo_evento.color" class="color-input" />
              <input type="text" v-model="profiles.nuevo_evento.color" class="hex-text" maxlength="7" />
            </div>
          </div>

          <div class="control-group">
            <label>{{ t('settings.mode_label') }}</label>
            <select v-model="profiles.nuevo_evento.mode" class="select-input">
              <option value="ON">{{ t('settings.modes.on') }}</option>
              <option value="OFF">{{ t('settings.modes.off') }}</option>
              <option value="BLINK">{{ t('settings.modes.blink') }}</option>
              <option value="FADING_BLINK">{{ t('settings.modes.fading_blink') }}</option>
            </select>
          </div>

          <div class="control-group">
            <div class="slider-label-row">
              <label>{{ t('settings.intensity_label') }}</label>
              <span class="value-badge">{{ profiles.nuevo_evento.intensity }}</span>
            </div>
            <input type="range" min="0" max="255" step="1" v-model.number="profiles.nuevo_evento.intensity" class="range-slider" />
          </div>

          <div class="control-group">
            <label>{{ t('settings.ringtone_label') }}</label>
            <div class="ringtone-picker-row">
              <select v-model="profiles.nuevo_evento.ringtone" class="select-input ringtone-select">
                <option value="">{{ t('settings.ringtone_none') }}</option>
                <option v-for="ring in ringtones" :key="ring" :value="ring">{{ ring }}</option>
              </select>
              <button 
                class="play-preview-btn" 
                :disabled="!profiles.nuevo_evento.ringtone"
                @click="togglePreview(profiles.nuevo_evento.ringtone)"
                :class="{ playing: playingRingtone === profiles.nuevo_evento.ringtone }"
              >
                <span v-if="playingRingtone === profiles.nuevo_evento.ringtone">⏹️</span>
                <span v-else>▶️</span>
              </button>
            </div>
          </div>

          <div class="card-actions">
            <button class="action-btn simulate" @click="handleSimulate('nuevo_evento')">
              {{ t('settings.simulate_notif') }}
            </button>
            <button class="action-btn update" @click="handleSaveSingle('nuevo_evento')">
              {{ t('settings.update_notif') }}
            </button>
          </div>
        </div>

        <!-- nueva_foto -->
        <div class="config-card glass-panel photo-card">
          <div class="card-header">
            <span class="header-icon">💬</span>
            <h2>{{ t('settings.notifications_nueva_foto') }}</h2>
          </div>

          <div class="control-group">
            <label>{{ t('settings.color_label') }}</label>
            <div class="color-picker-wrapper">
              <div class="color-preview" :style="{ backgroundColor: profiles.nueva_foto.color }"></div>
              <input type="color" v-model="profiles.nueva_foto.color" class="color-input" />
              <input type="text" v-model="profiles.nueva_foto.color" class="hex-text" maxlength="7" />
            </div>
          </div>

          <div class="control-group">
            <label>{{ t('settings.mode_label') }}</label>
            <select v-model="profiles.nueva_foto.mode" class="select-input">
              <option value="ON">{{ t('settings.modes.on') }}</option>
              <option value="OFF">{{ t('settings.modes.off') }}</option>
              <option value="BLINK">{{ t('settings.modes.blink') }}</option>
              <option value="FADING_BLINK">{{ t('settings.modes.fading_blink') }}</option>
            </select>
          </div>

          <div class="control-group">
            <div class="slider-label-row">
              <label>{{ t('settings.intensity_label') }}</label>
              <span class="value-badge">{{ profiles.nueva_foto.intensity }}</span>
            </div>
            <input type="range" min="0" max="255" step="1" v-model.number="profiles.nueva_foto.intensity" class="range-slider" />
          </div>

          <div class="control-group">
            <label>{{ t('settings.ringtone_label') }}</label>
            <div class="ringtone-picker-row">
              <select v-model="profiles.nueva_foto.ringtone" class="select-input ringtone-select">
                <option value="">{{ t('settings.ringtone_none') }}</option>
                <option v-for="ring in ringtones" :key="ring" :value="ring">{{ ring }}</option>
              </select>
              <button 
                class="play-preview-btn" 
                :disabled="!profiles.nueva_foto.ringtone"
                @click="togglePreview(profiles.nueva_foto.ringtone)"
                :class="{ playing: playingRingtone === profiles.nueva_foto.ringtone }"
              >
                <span v-if="playingRingtone === profiles.nueva_foto.ringtone">⏹️</span>
                <span v-else>▶️</span>
              </button>
            </div>
          </div>

          <div class="card-actions">
            <button class="action-btn simulate" @click="handleSimulate('nueva_foto')">
              {{ t('settings.simulate_notif') }}
            </button>
            <button class="action-btn update" @click="handleSaveSingle('nueva_foto')">
              {{ t('settings.update_notif') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="actions-footer">
        <button class="save-all-btn" @click="handleSaveAll">
          {{ t('settings.update_all') }}
        </button>
        <transition name="fade">
          <div class="success-toast" v-if="saveSuccess">
            ✨ {{ t('settings.notifications_saved_success') }}
          </div>
        </transition>
      </div>
    </div>

    <!-- Loading state -->
    <div class="loading-state glass-panel" v-else>
      <div class="spinner"></div>
      <p>{{ t('common.loading') }}</p>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  height: 100vh;
  padding: 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.85);
  border-radius: 20px;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
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
}

.back-btn img {
  width: 2.8rem;
  height: 2.8rem;
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  overflow: hidden;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  flex: 1;
  overflow-y: auto;
  padding-bottom: 0.5rem;
}

.config-card {
  padding: 1.8rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  border-top: 5px solid #ccc;
  transition: transform 0.2s, box-shadow 0.2s;
}

.config-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
}

.call-card { border-top-color: #22c55e; }
.event-card { border-top-color: #ef4444; }
.photo-card { border-top-color: #3b82f6; }

.card-header {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.header-icon {
  font-size: 2rem;
}

.card-header h2 {
  font-size: 1.7rem;
  font-weight: 800;
  margin: 0;
  color: #333;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.control-group label {
  font-size: 1.1rem;
  font-weight: 700;
  color: #444;
}

.color-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.color-preview {
  width: 3.2rem;
  height: 3.2rem;
  border-radius: 8px;
  border: 2px solid rgba(0, 0, 0, 0.12);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
}

.color-input {
  width: 3.6rem;
  height: 3.2rem;
  border: none;
  background: transparent;
  cursor: pointer;
}

.hex-text {
  flex: 1;
  font-size: 1.2rem;
  padding: 0.5rem 0.8rem;
  border-radius: 8px;
  border: 1px solid #ccc;
  font-family: monospace;
}

.select-input {
  font-size: 1.2rem;
  padding: 0.7rem 1rem;
  border-radius: 10px;
  border: 1px solid #ccc;
  background: white;
  width: 100%;
}

.ringtone-picker-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.ringtone-select {
  flex: 1;
}

.play-preview-btn {
  width: 3.2rem;
  height: 3.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid #ccc;
  background: white;
  cursor: pointer;
  font-size: 1.1rem;
  transition: background 0.15s, transform 0.1s;
}

.play-preview-btn:hover {
  background: #f5f5f5;
}

.play-preview-btn.playing {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}

.play-preview-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.slider-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.value-badge {
  font-size: 1rem;
  font-weight: 700;
  background: rgba(11, 87, 208, 0.08);
  color: #0b57d0;
  padding: 0.15rem 0.5rem;
  border-radius: 5px;
}

.range-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #ddd;
  outline: none;
  accent-color: #0b57d0;
}

.card-actions {
  display: flex;
  gap: 0.6rem;
  margin-top: auto;
  padding-top: 1rem;
}

.action-btn {
  flex: 1;
  padding: 0.8rem 0.4rem;
  font-size: 1.1rem;
  font-weight: 700;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.action-btn.simulate {
  border: 2px solid #ccc;
  background: transparent;
  color: #555;
}

.action-btn.simulate:active {
  background: rgba(0,0,0,0.05);
}

.action-btn.update {
  border: 2px solid #0b57d0;
  background: #0b57d0;
  color: white;
}

.action-btn.update:active {
  transform: scale(0.97);
}

.actions-footer {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 1rem 0;
}

.save-all-btn {
  padding: 1.2rem 3.5rem;
  font-size: 1.6rem;
  font-weight: 800;
  border: none;
  background: #0b57d0;
  color: white;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 15px rgba(11, 87, 208, 0.25);
}

.save-all-btn:active {
  transform: scale(0.97);
  box-shadow: none;
}

.success-toast {
  font-size: 1.3rem;
  font-weight: 700;
  color: #1a7f37;
  background: rgba(26, 127, 55, 0.08);
  padding: 0.8rem 1.5rem;
  border-radius: 12px;
}

.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.spinner {
  width: 3rem;
  height: 3rem;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top-color: #0b57d0;
  border-radius: 50%;
  animation: spin 1s infinite linear;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
