<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()

interface ButtonConfig {
  color: string
  shape: string
  mode: string
  intensity: number
}

const pic1 = ref<ButtonConfig>({
  color: '#ffffff',
  shape: 'all',
  mode: 'on',
  intensity: 255
})

const pic2 = ref<ButtonConfig>({
  color: '#ffffff',
  shape: 'all',
  mode: 'on',
  intensity: 255
})

const isLoading = ref(true)
const saveSuccess = ref(false)

onMounted(async () => {
  try {
    const settings = await (window as any).config.getSettings()
    const colors = settings.button_colors || {}
    if (colors.PIC1) {
      pic1.value = { ...pic1.value, ...colors.PIC1 }
    }
    if (colors.PIC2) {
      pic2.value = { ...pic2.value, ...colors.PIC2 }
    }
  } catch (e) {
    console.error('Failed to load button colors:', e)
  } finally {
    isLoading.value = false
  }
})

function goBack() {
  router.push('/settings')
}

async function handleSaveSingle(picId: 'PIC1' | 'PIC2') {
  try {
    const settings = await (window as any).config.getSettings()
    const currentColors = settings.button_colors || {}
    
    const updatedColors = {
      ...currentColors,
      [picId]: picId === 'PIC1' ? { ...pic1.value } : { ...pic2.value }
    }
    
    const success = await (window as any).config.saveButtonColors(updatedColors)
    if (success) {
      triggerSuccessFlash()
    }
  } catch (e) {
    console.error('Failed to save button colors:', e)
  }
}

async function handleSaveAll() {
  try {
    const updatedColors = {
      PIC1: { ...pic1.value },
      PIC2: { ...pic2.value }
    }
    const success = await (window as any).config.saveButtonColors(updatedColors)
    if (success) {
      triggerSuccessFlash()
    }
  } catch (e) {
    console.error('Failed to save button colors:', e)
  }
}

function triggerSuccessFlash() {
  saveSuccess.value = true
  setTimeout(() => {
    saveSuccess.value = false
  }, 2500)
}
</script>

<template>
  <div class="view-container">
    <!-- Header -->
    <div class="header glass-panel">
      <div class="header-left">
        <h1 class="header-title">{{ t('settings.colors') }}</h1>
      </div>
      <button class="back-btn" @click="goBack">
        <img src="/images/back.png" :alt="t('common.back')" />
      </button>
    </div>

    <!-- Main Content -->
    <div class="content-area" v-if="!isLoading">
      <div class="cards-grid">
        <!-- PIC 1 -->
        <div class="config-card glass-panel">
          <div class="card-header">
            <h2>{{ t('settings.colors_pic1') }}</h2>
          </div>
          
          <div class="control-group">
            <label>{{ t('settings.color_label') }}</label>
            <div class="color-picker-wrapper">
              <div class="color-preview" :style="{ backgroundColor: pic1.color }"></div>
              <input type="color" v-model="pic1.color" class="color-input" />
              <input type="text" v-model="pic1.color" class="hex-text" maxlength="7" />
            </div>
          </div>

          <div class="control-group">
            <label>{{ t('settings.shape_label') }}</label>
            <select v-model="pic1.shape" class="select-input">
              <option value="all">{{ t('settings.shapes.all') }}</option>
              <option value="square">{{ t('settings.shapes.square') }}</option>
              <option value="diamond">{{ t('settings.shapes.diamond') }}</option>
              <option value="plus">{{ t('settings.shapes.plus') }}</option>
              <option value="X">{{ t('settings.shapes.x') }}</option>
              <option value="only_center">{{ t('settings.shapes.only_center') }}</option>
            </select>
          </div>

          <div class="control-group">
            <label>{{ t('settings.mode_label') }}</label>
            <select v-model="pic1.mode" class="select-input">
              <option value="on">{{ t('settings.modes.on') }}</option>
              <option value="off">{{ t('settings.modes.off') }}</option>
              <option value="blink">{{ t('settings.modes.blink') }}</option>
              <option value="fading_blink">{{ t('settings.modes.fading_blink') }}</option>
            </select>
          </div>

          <div class="control-group">
            <div class="slider-label-row">
              <label>{{ t('settings.intensity_label') }}</label>
              <span class="value-badge">{{ pic1.intensity }}</span>
            </div>
            <input type="range" min="0" max="255" step="1" v-model.number="pic1.intensity" class="range-slider" />
          </div>

          <button class="update-single-btn" @click="handleSaveSingle('PIC1')">
            {{ t('settings.update_pic1') }}
          </button>
        </div>

        <!-- PIC 2 -->
        <div class="config-card glass-panel">
          <div class="card-header">
            <h2>{{ t('settings.colors_pic2') }}</h2>
          </div>
          
          <div class="control-group">
            <label>{{ t('settings.color_label') }}</label>
            <div class="color-picker-wrapper">
              <div class="color-preview" :style="{ backgroundColor: pic2.color }"></div>
              <input type="color" v-model="pic2.color" class="color-input" />
              <input type="text" v-model="pic2.color" class="hex-text" maxlength="7" />
            </div>
          </div>

          <div class="control-group">
            <label>{{ t('settings.shape_label') }}</label>
            <select v-model="pic2.shape" class="select-input">
              <option value="all">{{ t('settings.shapes.all') }}</option>
              <option value="square">{{ t('settings.shapes.square') }}</option>
              <option value="diamond">{{ t('settings.shapes.diamond') }}</option>
              <option value="plus">{{ t('settings.shapes.plus') }}</option>
              <option value="X">{{ t('settings.shapes.x') }}</option>
              <option value="only_center">{{ t('settings.shapes.only_center') }}</option>
            </select>
          </div>

          <div class="control-group">
            <label>{{ t('settings.mode_label') }}</label>
            <select v-model="pic2.mode" class="select-input">
              <option value="on">{{ t('settings.modes.on') }}</option>
              <option value="off">{{ t('settings.modes.off') }}</option>
              <option value="blink">{{ t('settings.modes.blink') }}</option>
              <option value="fading_blink">{{ t('settings.modes.fading_blink') }}</option>
            </select>
          </div>

          <div class="control-group">
            <div class="slider-label-row">
              <label>{{ t('settings.intensity_label') }}</label>
              <span class="value-badge">{{ pic2.intensity }}</span>
            </div>
            <input type="range" min="0" max="255" step="1" v-model.number="pic2.intensity" class="range-slider" />
          </div>

          <button class="update-single-btn" @click="handleSaveSingle('PIC2')">
            {{ t('settings.update_pic2') }}
          </button>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="actions-footer">
        <button class="save-all-btn" @click="handleSaveAll">
          {{ t('settings.update_all') }}
        </button>
        <transition name="fade">
          <div class="success-toast" v-if="saveSuccess">
            ✨ {{ t('settings.colors_saved_success') }}
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
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
  flex: 1;
  overflow-y: auto;
  padding-bottom: 0.5rem;
}

.config-card {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.card-header h2 {
  font-size: 2rem;
  font-weight: 800;
  margin: 0;
  color: #0b57d0;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.control-group label {
  font-size: 1.2rem;
  font-weight: 700;
  color: #444;
}

.color-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.color-preview {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 10px;
  border: 2px solid rgba(0, 0, 0, 0.15);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
}

.color-input {
  width: 4rem;
  height: 3.5rem;
  border: none;
  background: transparent;
  cursor: pointer;
}

.hex-text {
  flex: 1;
  font-size: 1.3rem;
  padding: 0.6rem 1rem;
  border-radius: 10px;
  border: 1px solid #ccc;
  font-family: monospace;
}

.select-input {
  font-size: 1.3rem;
  padding: 0.8rem 1.2rem;
  border-radius: 12px;
  border: 1px solid #ccc;
  background: white;
  width: 100%;
}

.slider-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.value-badge {
  font-size: 1.1rem;
  font-weight: 700;
  background: rgba(11, 87, 208, 0.08);
  color: #0b57d0;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
}

.range-slider {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: #ddd;
  outline: none;
  accent-color: #0b57d0;
}

.update-single-btn {
  margin-top: auto;
  padding: 1rem;
  font-size: 1.3rem;
  font-weight: 700;
  border: 2px solid #0b57d0;
  background: transparent;
  color: #0b57d0;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.update-single-btn:active {
  background: rgba(11, 87, 208, 0.05);
  transform: scale(0.98);
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
