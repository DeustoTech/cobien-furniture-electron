<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()

const currentJoke = ref(t('jokes.loading'))
const isLoading = ref(false)

async function fetchJoke() {
  isLoading.value = true
  try {
    currentJoke.value = await (window as any).config.getRandomJoke()
  } catch (e) {
    currentJoke.value = t('jokes.fallback')
  } finally {
    isLoading.value = false
  }
}



function triggerVoiceAssistant() {
  window.dispatchEvent(new CustomEvent('start-voice-assistant'))
}

onMounted(fetchJoke)
</script>

<template>
  <div class="view-container">
    <!-- Header -->
    <div class="header">
      <button class="icon-btn" @click="router.push('/')">
        <img src="/images/back.png" :alt="t('jokes.back')" class="hdr-icon" />
      </button>
      <h1 class="header-title">{{ t('jokes.title') }}</h1>
      <button class="icon-btn" @click="triggerVoiceAssistant">
        <img src="/images/voice.png" :alt="t('jokes.listen')" class="hdr-icon" />
      </button>
    </div>

    <!-- Joke card -->
    <div class="joke-card glass-panel">
      <div class="quote-mark">"</div>
      <p class="joke-text" :class="{ loading: isLoading }">
        {{ currentJoke }}
      </p>
      <div class="quote-mark close-quote">"</div>
    </div>

    <!-- Next button -->
    <div class="btn-row">
      <button class="next-btn" @click="fetchJoke" :disabled="isLoading">
        <span v-if="isLoading" class="mini-spinner" />
        <span v-else>{{ t('jokes.another') }}</span>
      </button>
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
  align-items: center;
  justify-content: space-between;
}

.header-title {
  font-size: 3rem;
  font-weight: 800;
  color: var(--text-primary);
  background: rgba(255,255,255,0.6);
  padding: 0.5rem 2rem;
  border-radius: 20px;
  backdrop-filter: blur(10px);
}

.icon-btn {
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 14px;
  background: rgba(255,255,255,0.8);
  border: 1.5px solid rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transition: transform 0.15s;
}

.icon-btn:active { transform: scale(0.92); }

.hdr-icon {
  width: 2.5rem;
  height: 2.5rem;
  object-fit: contain;
}

/* Joke card */
.joke-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 5rem;
  border-radius: 28px;
  background: rgba(255,255,255,0.72);
  backdrop-filter: blur(16px);
  box-shadow: 0 16px 48px rgba(0,0,0,0.1);
  position: relative;
}

.quote-mark {
  font-size: 8rem;
  font-family: Georgia, serif;
  color: rgba(30,144,255,0.25);
  line-height: 0.8;
  align-self: flex-start;
}

.close-quote {
  align-self: flex-end;
  transform: scaleX(-1);
}

.joke-text {
  font-size: 2.2rem;
  font-weight: 500;
  color: #111;
  text-align: center;
  line-height: 1.7;
  max-width: 80%;
  margin: 1rem auto;
  transition: opacity 0.3s;
}

.joke-text.loading {
  opacity: 0.4;
}

/* Button row */
.btn-row {
  display: flex;
  justify-content: center;
}

.next-btn {
  background: linear-gradient(135deg, #2196F3, #1565C0);
  color: white;
  border: none;
  border-radius: 20px;
  padding: 1.2rem 4rem;
  font-size: 1.6rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(33,150,243,0.5);
  transition: transform 0.15s, box-shadow 0.15s;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 18rem;
  justify-content: center;
}

.next-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.next-btn:not(:disabled):active {
  transform: scale(0.96);
  box-shadow: 0 4px 12px rgba(33,150,243,0.4);
}

.mini-spinner {
  display: inline-block;
  width: 1.5rem;
  height: 1.5rem;
  border: 3px solid rgba(255,255,255,0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
