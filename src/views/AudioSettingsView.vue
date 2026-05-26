<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { startListening, stopListening } from '../services/voiceRecognizer'

const router = useRouter()
const { t, locale } = useI18n()

const isTtsTesting = ref(false)
const isSttTesting = ref(false)
const sttText = ref('')
const audioLevel = ref(0)

function goBack() {
  router.push('/settings')
}

async function testSpeaker() {
  if (isTtsTesting.value) return
  isTtsTesting.value = true
  try {
    const text = t('audio.test_phrase')
    const buffer = await (window as any).config.ttsSpeak(text)
    if (buffer) {
      const audioCtx = new AudioContext()
      await audioCtx.resume()
      
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      const decoded = await audioCtx.decodeAudioData(arrayBuffer)
      const source = audioCtx.createBufferSource()

      source.buffer = decoded
      source.connect(audioCtx.destination)
      await new Promise<void>(resolve => {
        source.onended = () => resolve()
        source.start()
      })
    }
  } catch (e) {
    console.error('TTS Test failed:', e)
  } finally {
    isTtsTesting.value = false
  }
}

async function testMicrophone() {
  if (isSttTesting.value) return
  isSttTesting.value = true
  sttText.value = t('audio.listening')
  audioLevel.value = 0

  try {
    await startListening(
      locale.value.split('-')[0],
      // onResult
      (text) => {
        sttText.value = text || t('audio.no_voice')
        stopListening()
        isSttTesting.value = false
        audioLevel.value = 0
      },
      // onPartial
      (partialText) => {
        if (partialText) sttText.value = partialText
      },
      // onLevel
      (lvl) => {
        audioLevel.value = lvl
      }
    )
  } catch (e) {
    console.error('STT Test failed:', e)
    sttText.value = t('audio.mic_error')
    stopListening()
    isSttTesting.value = false
    audioLevel.value = 0
  }
}

onUnmounted(() => {
  stopListening()
})
</script>

<template>
  <div class="view-container">
    <!-- Header -->
    <div class="header glass-panel">
      <div class="header-left">
        <h1 class="header-title">{{ t('audio.title') }}</h1>
      </div>
      <button class="back-btn" @click="goBack">
        <img src="/images/back.png" :alt="t('audio.back')" />
      </button>
    </div>

    <div class="test-area glass-panel">
      <!-- Speaker Test -->
      <div class="test-section">
        <div class="section-info">
          <h2>{{ t('audio.speaker_title') }}</h2>
          <p>{{ t('audio.speaker_desc') }}</p>
        </div>
        <button class="test-btn" :disabled="isTtsTesting" @click="testSpeaker">
          <span v-if="!isTtsTesting">{{ t('audio.test_speaker') }}</span>
          <span v-else>{{ t('audio.speaking') }}</span>
        </button>
      </div>

      <hr class="divider" />

      <!-- Mic Test -->
      <div class="test-section">
        <div class="section-info">
          <h2>{{ t('audio.mic_title') }}</h2>
          <p>{{ t('audio.mic_desc') }}</p>
        </div>
        
        <div class="mic-visualizer" v-if="isSttTesting">
          <div v-for="i in 8" :key="i" class="v-bar" :style="{ transform: `scaleY(${0.2 + audioLevel * 3})` }"></div>
        </div>

        <div class="stt-result" v-if="sttText">
          "{{ sttText }}"
        </div>

        <button class="test-btn mic" :disabled="isSttTesting" @click="testMicrophone">
          <span v-if="!isSttTesting">{{ t('audio.test_mic') }}</span>
          <span v-else>{{ t('audio.listening') }}</span>
        </button>
      </div>
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
  padding: 1.5rem 2rem;
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

.test-area {
  flex: 1;
  padding: 3rem;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.test-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1.5rem;
}

.section-info h2 {
  font-size: 2rem;
  margin: 0;
  color: #333;
}

.section-info p {
  font-size: 1.2rem;
  color: #666;
  margin: 0.5rem 0 0;
}

.test-btn {
  padding: 1.2rem 3rem;
  border-radius: 15px;
  border: none;
  background: #007AFF;
  color: white;
  font-size: 1.5rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 15px rgba(0, 122, 255, 0.3);
}

.test-btn:active { transform: scale(0.95); }
.test-btn:disabled { background: #ccc; box-shadow: none; cursor: default; }

.test-btn.mic {
  background: #28a745;
  box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
}

.divider {
  border: 0;
  border-top: 1px solid rgba(0,0,0,0.1);
  width: 100%;
}

.mic-visualizer {
  display: flex;
  gap: 6px;
  height: 50px;
  align-items: center;
}

.v-bar {
  width: 8px;
  height: 100%;
  background: #28a745;
  border-radius: 4px;
  transition: transform 0.1s ease;
}

.stt-result {
  font-size: 1.6rem;
  font-style: italic;
  color: #111;
  background: rgba(0,0,0,0.05);
  padding: 1rem 2rem;
  border-radius: 12px;
  max-width: 80%;
}
</style>
