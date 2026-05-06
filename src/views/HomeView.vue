<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const currentDate = ref('')
const currentTime = ref('')
const weatherTemp = ref('7°')
const weatherCondition = ref('Cielo claro')
const cityName = ref('Bilbao')
const minMaxTemp = ref('Min 7°   Max 19°')
const nextEvent = ref('Sin eventos próximos')
const jokeTitle = ref('Frase del día')
const jokeText = ref('¿Qué le dice un jardinero a otro? Nos vemos cuando podamos.')

let timer: number

onMounted(() => {
  updateTime()
  timer = window.setInterval(updateTime, 1000)
})

onUnmounted(() => {
  clearInterval(timer)
})

function updateTime() {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  // Formatted like: Miércoles, 6 de mayo, 2026
  currentDate.value = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/^\w/, (c) => c.toUpperCase()) // Capitalize first letter
}

function handleNavigation(route: string) {
  router.push(route)
}

async function playTTS(text: string) {
  try {
    const buffer = await (window as any).tts.speak(text)
    if (buffer) {
      const blob = new Blob([buffer], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.play()
    } else {
      console.warn('TTS returned no buffer. Ensure Piper is installed and configured.')
    }
  } catch(e) {
    console.error('Failed to play TTS:', e)
  }
}
</script>

<template>
  <div class="home-container">
    <!-- Top Header Card -->
    <div class="top-section">
      <div class="header-card glass-header">
        
        <!-- Column 1: Time and Date -->
        <div class="header-col col-time">
          <div class="date-text">{{ currentDate }}</div>
          <div class="time-text">{{ currentTime }}</div>
        </div>

        <div class="v-separator"></div>

        <!-- Column 2: Weather -->
        <div class="header-col col-weather">
          <div class="weather-condition">{{ weatherCondition }} en {{ cityName }}</div>
          <div class="weather-main">
            <!-- Icon is currently a moon placeholder, we can use the actual image -->
            <img src="/images/noche.png" class="weather-icon" alt="weather" />
            <div class="temp-group">
              <div class="temp-text">{{ weatherTemp }}</div>
              <div class="minmax-text">{{ minMaxTemp }}</div>
            </div>
          </div>
        </div>

        <div class="v-separator"></div>

        <!-- Column 3: Events and Jokes -->
        <div class="header-col col-events">
          <div class="events-top">
            <div class="events-content">
              <div class="section-title">Próximos eventos</div>
              <div class="event-item">{{ nextEvent }}</div>
            </div>
            <div class="top-buttons">
              <button class="icon-button"><img src="/images/settings.png" alt="settings" /></button>
              <button class="icon-button" @click="playTTS(jokeText)"><img src="/images/voice.png" alt="voice" /></button>
            </div>
          </div>
          <div class="joke-container">
            <div class="section-title">{{ jokeTitle }}</div>
            <div class="joke-text">{{ jokeText }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation Cards 2x2 Grid -->
    <div class="nav-section">
      <button class="nav-card" @click="handleNavigation('/weather')">
        <img src="/images/parcial.png" class="nav-card-icon" alt="Tiempo" />
        <span class="nav-card-text">Tiempo</span>
      </button>
      <button class="nav-card" @click="handleNavigation('/events')">
        <img src="/images/eventos.png" class="nav-card-icon" alt="Eventos" />
        <span class="nav-card-text">Eventos</span>
      </button>
      <button class="nav-card" @click="handleNavigation('/board')">
        <img src="/images/pizarra.png" class="nav-card-icon" alt="Pizarra" />
        <span class="nav-card-text">Pizarra</span>
      </button>
      <button class="nav-card" @click="handleNavigation('/call')">
        <img src="/images/videollamada.png" class="nav-card-icon" alt="Llámame" />
        <span class="nav-card-text">Llámame</span>
      </button>
    </div>

    <!-- Footer Controls -->
    <div class="footer-controls">
      <!-- We can use local volume/brightness icons if available or emojis as placeholder -->
      <button class="control-badge">🔊</button>
      <button class="control-badge">🔆</button>
    </div>
    
    <div class="footer-meta">
      <div class="meta-badge">CoBien2 - v3.2.40</div>
    </div>
  </div>
</template>

<style scoped>
.home-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 2.5rem 3rem 5rem 3rem;
  gap: 1.5rem;
  position: relative;
}

.top-section {
  display: flex;
  width: 100%;
}

.header-card {
  width: 100%;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.6); /* Translucent frosted glass */
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.header-col {
  display: flex;
  flex-direction: column;
}

.col-time {
  flex: 1.2;
  padding-right: 1.5rem;
  justify-content: flex-start;
}

.col-weather {
  flex: 1;
  padding: 0 1.5rem;
  justify-content: flex-start;
}

.col-events {
  flex: 2;
  padding-left: 1.5rem;
  justify-content: flex-start;
}

.v-separator {
  width: 2px;
  background-color: rgba(0, 0, 0, 0.15);
  margin: 0.5rem 0;
  border-radius: 1px;
}

/* Time & Date */
.date-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111;
  margin-bottom: 0.5rem;
}

.time-text {
  font-size: 7.5rem;
  font-weight: 400;
  line-height: 1;
  color: #000;
  letter-spacing: -2px;
}

/* Weather */
.weather-condition {
  font-size: 1.3rem;
  font-weight: 700;
  color: #111;
  margin-bottom: 1.5rem;
}

.weather-main {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.weather-icon {
  width: 5rem;
  height: 5rem;
  object-fit: contain;
}

.temp-group {
  display: flex;
  flex-direction: column;
}

.temp-text {
  font-size: 3rem;
  font-weight: 600;
  color: #000;
  line-height: 1.1;
}

.minmax-text {
  font-size: 1rem;
  font-weight: 500;
  color: #222;
}

/* Events & Joke */
.events-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.section-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: #111;
  margin-bottom: 0.3rem;
}

.event-item, .joke-text {
  font-size: 1.1rem;
  color: #222;
  font-weight: 400;
}

.joke-text {
  line-height: 1.4;
  padding-right: 2rem;
}

/* Top Buttons */
.top-buttons {
  display: flex;
  gap: 0.5rem;
}

.icon-button {
  width: 4rem;
  height: 4rem;
  border-radius: 12px;
  background: white;
  border: 1px solid rgba(0,0,0,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.icon-button:active {
  transform: scale(0.95);
}

.icon-button img {
  width: 2.5rem;
  height: 2.5rem;
  object-fit: contain;
}

/* 2x2 Nav Grid */
.nav-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 1.5rem;
  flex: 1;
}

.nav-card {
  background: white;
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,0.1);
  box-shadow: 0 4px 10px rgba(0,0,0,0.05);
  display: flex;
  align-items: center;
  padding: 0 4rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.nav-card:active {
  transform: scale(0.98);
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.nav-card-icon {
  width: 7rem;
  height: 7rem;
  object-fit: contain;
}

.nav-card-text {
  font-size: 2.8rem;
  font-weight: 400;
  color: #000;
  margin-left: 3rem;
}

/* Footer */
.footer-controls {
  position: absolute;
  bottom: 1.5rem;
  left: 3rem;
  display: flex;
  gap: 0.8rem;
}

.control-badge {
  background: white;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 12px;
  width: 3.5rem;
  height: 3.5rem;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.control-badge:active {
  transform: scale(0.95);
}

.footer-meta {
  position: absolute;
  bottom: 1.5rem;
  right: 3rem;
}

.meta-badge {
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  padding: 0.4rem 1rem;
  border-radius: 20px;
  border: 1px solid rgba(0,0,0,0.1);
  font-size: 0.85rem;
  font-weight: 700;
  color: #333;
}
</style>
