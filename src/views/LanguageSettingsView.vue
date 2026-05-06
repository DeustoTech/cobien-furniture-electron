<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSettings } from '../composables/useSettings'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { lang, voiceGenders } = useSettings()
const { t } = useI18n()

function goBack() {
  router.push('/settings')
}

function setLang(newLang: string) {
  lang.value = newLang
}

function setGender(l: string, gender: 'male' | 'female') {
  voiceGenders.value[l] = gender
}
</script>

<template>
  <div class="view-container">
    <div class="header glass-panel">
      <div class="header-left">
        <h1 class="header-title">{{ t('settings.language') }}</h1>
      </div>
      <div class="header-actions">
        <button class="back-btn" @click="goBack">
          <img src="/images/back.png" alt="Volver" />
        </button>
      </div>
    </div>

    <div class="settings-content glass-panel">
      <div class="lang-section">
        <h3>{{ t('settings.language') }}</h3>
        <div class="lang-grid">
          <button 
            class="lang-btn" 
            :class="{ active: lang === 'es' }"
            @click="setLang('es')"
          >
            <span class="flag">🇪🇸</span> Spanish
          </button>
          <button 
            class="lang-btn" 
            :class="{ active: lang === 'fr' }"
            @click="setLang('fr')"
          >
            <span class="flag">🇫🇷</span> French
          </button>
        </div>
      </div>

      <div class="voice-section">
        <h3>Voz del Asistente</h3>
        
        <!-- Spanish Voice -->
        <div class="voice-row">
          <div class="voice-info">
            <span class="flag">🇪🇸</span> Spanish Voice
          </div>
          <div class="voice-options">
            <button 
              class="opt-btn" 
              :class="{ active: voiceGenders.es === 'male' }"
              @click="setGender('es', 'male')"
            >
              Masculino
            </button>
            <button 
              class="opt-btn" 
              :class="{ active: voiceGenders.es === 'female' }"
              @click="setGender('es', 'female')"
            >
              Femenino
            </button>
          </div>
        </div>

        <!-- French Voice -->
        <div class="voice-row">
          <div class="voice-info">
            <span class="flag">🇫🇷</span> French Voice
          </div>
          <div class="voice-options">
            <button 
              class="opt-btn" 
              :class="{ active: voiceGenders.fr === 'male' }"
              @click="setGender('fr', 'male')"
            >
              Masculino
            </button>
            <button 
              class="opt-btn" 
              :class="{ active: voiceGenders.fr === 'female' }"
              @click="setGender('fr', 'female')"
            >
              Femenino
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  height: 100vh;
  padding: 2rem 3rem;
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
}

.back-btn {
  width: 4rem;
  height: 4rem;
  background: white;
  border: 2px solid #000;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn img {
  width: 2.5rem;
}

.settings-content {
  flex: 1;
  padding: 3rem;
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

h3 {
  font-size: 1.8rem;
  margin-bottom: 1.5rem;
  color: #333;
}

.lang-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
}

.lang-btn {
  padding: 2rem;
  background: white;
  border: 2px solid #ddd;
  border-radius: 20px;
  font-size: 1.5rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.lang-btn.active {
  border-color: var(--accent-blue);
  background: rgba(59, 130, 246, 0.05);
}

.flag {
  font-size: 2rem;
}

.voice-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 16px;
  margin-bottom: 1rem;
}

.voice-info {
  font-size: 1.4rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.voice-options {
  display: flex;
  gap: 1rem;
}

.opt-btn {
  padding: 0.8rem 1.5rem;
  border: 1.5px solid #ccc;
  background: white;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
}

.opt-btn.active {
  background: #333;
  color: white;
  border-color: #333;
}
</style>
