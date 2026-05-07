<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSettings } from '../composables/useSettings'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { lang, ttsEngine } = useSettings()
const { t } = useI18n()

function goBack() {
  router.push('/settings')
}

function setLang(newLang: string) {
  lang.value = newLang
  const gender = newLang === 'es' ? 'male' : 'female'
  previewVoice(newLang, gender)
}


function setEngine(engine: 'piper') {
  ttsEngine.value = engine
}




async function previewVoice(l: string, g: 'male' | 'female') {
  const text = 'Hello! This will be my voice'

  try {
    const buffer = await (window as any).config.ttsSpeak(text, l, g, ttsEngine.value)

    if (buffer) {
      const audioCtx = new AudioContext()
      await audioCtx.resume()
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      const decoded = await audioCtx.decodeAudioData(arrayBuffer)
      const source = audioCtx.createBufferSource()
      source.buffer = decoded
      source.connect(audioCtx.destination)
      source.start()
    }
  } catch (e) {
    console.error('Preview error:', e)
  }
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
      <div class="engine-section">
        <h3>{{ t('settings.engine') }}</h3>
        <p class="section-desc">{{ t('settings.engine_desc') }}</p>
        <div class="engine-grid">
          <button 
            class="engine-btn" 
            :class="{ active: ttsEngine === 'piper' }"
            @click="setEngine('piper')"
          >
            <div class="engine-name">{{ t('settings.piper') }}</div>
            <div class="engine-tag">Fast & Local</div>
          </button>
        </div>
      </div>

      <div class="lang-section">

        <h3>{{ t('settings.language') }}</h3>
        <div class="lang-grid">
          <button 
            class="lang-btn" 
            :class="{ active: lang === 'en' }"
            @click="setLang('en')"
          >
            English
          </button>
        </div>
      </div>


    </div>
  </div>
</template>

<style scoped>
.view-container {
  height: 100vh;
  padding: 4rem 3rem 2rem;

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
  width: 5.5rem;
  height: 5.5rem;

  background: white;
  border: 2px solid #000;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn img {
  width: 3.5rem;

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
  margin-bottom: 0.5rem;
  color: #333;
}

.section-desc {
  font-size: 1.1rem;
  color: #666;
  margin-bottom: 1.5rem;
}

.engine-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.engine-btn {
  padding: 1.5rem;
  background: white;
  border: 2px solid #ddd;
  border-radius: 16px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.engine-btn.active {
  border-color: var(--accent-blue);
  background: rgba(59, 130, 246, 0.05);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.engine-name {
  font-size: 1.4rem;
  font-weight: 700;
  margin-bottom: 0.3rem;
}

.engine-tag {
  font-size: 0.9rem;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
}

.engine-btn.active .engine-tag {
  color: var(--accent-blue);
}

.lang-section {
  margin-top: 1rem;
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
