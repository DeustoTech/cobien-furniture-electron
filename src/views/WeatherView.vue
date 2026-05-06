<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const cityName = ref('Logroño')
const currentTemp = ref('6°')
const currentCondition = ref('Cielo claro')
const minTemp = ref('Min 7°')
const maxTemp = ref('Max 19°')

// Dummy data for hourly forecast matching the image
const hourlyForecast = ref([
  { time: '5 a.m.', icon: '/images/noche.png', temp: '8°' },
  { time: '6 a.m.', icon: '/images/sol.png', temp: '8°' },
  { time: '7 a.m.', icon: '/images/sol.png', temp: '7°' },
  { time: '8 a.m.', icon: '/images/sol.png', temp: '8°' },
  { time: '9 a.m.', icon: '/images/sol.png', temp: '9°' },
  { time: '10 a.m.', icon: '/images/parcial.png', temp: '12°' },
  { time: '11 a.m.', icon: '/images/sol.png', temp: '13°' },
  { time: '12 p.m.', icon: '/images/sol.png', temp: '15°' },
  { time: '1 p.m.', icon: '/images/parcial.png', temp: '17°' },
  { time: '2 p.m.', icon: '/images/parcial.png', temp: '18°' },
  { time: '3 p.m.', icon: '/images/nubes.png', temp: '18°' },
  { time: '4 p.m.', icon: '/images/nubes.png', temp: '19°' }
])

// Dummy data for daily forecast matching the image
const dailyForecast = ref([
  { day: 'Jueves', icon: '/images/lluvia.png', precip: '40%', min: 'Min 8°', max: 'Max 21°' },
  { day: 'Viernes', icon: '/images/lluvia.png', precip: '80%', min: 'Min 11°', max: 'Max 20°' },
  { day: 'Sábado', icon: '/images/lluvia.png', precip: '50%', min: 'Min 12°', max: 'Max 18°' },
  { day: 'Domingo', icon: '/images/nubes.png', precip: '31%', min: 'Min 10°', max: 'Max 22°' },
  { day: 'Lunes', icon: '/images/lluvia.png', precip: '35%', min: 'Min 11°', max: 'Max 18°' },
  { day: 'Martes', icon: '/images/lluvia.png', precip: '35%', min: 'Min 10°', max: 'Max 18°' }
])

function goBack() {
  router.push('/')
}

async function playTTS() {
  try {
    const text = `El tiempo en ${cityName.value} es de ${currentTemp.value} con ${currentCondition.value}.`
    const buffer = await (window as any).tts.speak(text)
    if (buffer) {
      const blob = new Blob([buffer], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.play()
    }
  } catch(e) {
    console.error('Failed to play TTS:', e)
  }
}
</script>

<template>
  <div class="view-container">
    
    <!-- Top Header Area -->
    <div class="header-section">
      <div class="header-left">
        <div class="title">Tiempo</div>
        <div class="city-name">{{ cityName }}</div>
      </div>
      
      <div class="header-center">
        <img src="/images/noche.png" alt="weather" class="main-weather-icon" />
        <div class="main-weather-info">
          <div class="main-temp">{{ currentTemp }}</div>
          <div class="main-desc">{{ currentCondition }}</div>
        </div>
      </div>

      <div class="header-right">
        <div class="min-max">
          <div>{{ minTemp }}</div>
          <div>{{ maxTemp }}</div>
        </div>
      </div>

      <div class="header-buttons">
        <button class="icon-button" @click="goBack">
          <img src="/images/back.png" alt="Volver" class="icon" />
        </button>
        <button class="icon-button" @click="playTTS">
          <img src="/images/voice.png" alt="Voice" class="icon" />
        </button>
      </div>
    </div>

    <!-- Hourly Forecast Bar -->
    <div class="hourly-bar">
      <div class="hourly-item" v-for="(hour, idx) in hourlyForecast" :key="idx">
        <div class="hour-time">{{ hour.time }}</div>
        <img :src="hour.icon" class="hour-icon" alt="hour weather" />
        <div class="hour-temp">{{ hour.temp }}</div>
      </div>
    </div>

    <!-- Daily Forecast Cards -->
    <div class="daily-section glass-panel">
      <div class="daily-card" v-for="(day, idx) in dailyForecast" :key="idx">
        <div class="day-name">{{ day.day }}</div>
        <img :src="day.icon" class="day-icon" alt="daily weather" />
        <div class="day-precip">{{ day.precip }}</div>
        <div class="day-minmax">
          <div>{{ day.min }}</div>
          <div>{{ day.max }}</div>
        </div>
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
  overflow: hidden;
}

/* Header Section */
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  position: relative;
  width: 100%;
}

.header-left {
  display: flex;
  flex-direction: column;
}

.title {
  font-size: 3rem;
  font-weight: 700;
  color: #000;
  line-height: 1;
}

.city-name {
  font-size: 5rem;
  font-weight: 800;
  color: #000;
  line-height: 1.1;
  margin-top: 0.5rem;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-left: 5rem;
  margin-top: 2rem;
}

.main-weather-icon {
  width: 6rem;
  height: 6rem;
  object-fit: contain;
}

.main-weather-info {
  display: flex;
  flex-direction: column;
}

.main-temp {
  font-size: 4.5rem;
  font-weight: 700;
  color: #000;
  line-height: 1;
}

.main-desc {
  font-size: 1.5rem;
  font-weight: 500;
  color: #222;
}

.header-right {
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-top: 3.5rem;
  font-size: 1.5rem;
  color: #111;
  font-weight: 500;
  gap: 0.3rem;
}

.header-buttons {
  display: flex;
  gap: 1rem;
  position: absolute;
  top: 0;
  right: 0;
}

.icon-button {
  width: 4rem;
  height: 4rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
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

.icon {
  width: 2.5rem;
  height: 2.5rem;
  object-fit: contain;
}

/* Hourly Bar */
.hourly-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 1.5rem 2rem;
  width: 100%;
}

.hourly-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.hour-time {
  font-size: 1rem;
  font-weight: 600;
  color: #111;
}

.hour-icon {
  width: 3.5rem;
  height: 3.5rem;
  object-fit: contain;
}

.hour-temp {
  font-size: 1.2rem;
  font-weight: 700;
  color: #000;
}

/* Daily Section */
.daily-section {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
  flex: 1;
  border-radius: 20px;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.4);
}

.daily-card {
  flex: 1;
  background: white;
  border-radius: 16px;
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  box-shadow: 0 4px 10px rgba(0,0,0,0.05);
}

.day-name {
  font-size: 1.5rem;
  font-weight: 500;
  color: #111;
  margin-bottom: 2rem;
}

.day-icon {
  width: 6rem;
  height: 6rem;
  object-fit: contain;
  margin-bottom: 1.5rem;
}

.day-precip {
  font-size: 1.2rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 2rem;
}

.day-minmax {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 500;
  color: #444;
  margin-top: auto;
}
</style>
