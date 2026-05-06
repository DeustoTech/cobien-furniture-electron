<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const cityName = ref('Cargando...')
const currentTemp = ref('—°')
const currentCondition = ref('Cargando...')
const minTemp = ref('Min —°')
const maxTemp = ref('Max —°')
const currentIcon = ref('/images/nubes.png')
const isLoading = ref(false)

const activeCities = ref<string[]>([])
const currentCityIndex = ref(0)

const hourlyForecast = ref<any[]>([])
const dailyForecast = ref<any[]>([])

let refreshTimer: ReturnType<typeof setInterval> | null = null

async function loadWeather(city: string) {
  if (!city || city === 'Sin Ciudad') return
  isLoading.value = true
  try {
    const bundle = await (window as any).config.fetchWeather(city)
    if (bundle) {
      currentTemp.value = bundle.temp
      currentCondition.value = bundle.description
      minTemp.value = bundle.tempMin
      maxTemp.value = bundle.tempMax
      currentIcon.value = bundle.icon
      hourlyForecast.value = bundle.hourly || []
      dailyForecast.value = bundle.daily || []
    }
  } catch (e) {
    console.error('[WEATHER] Failed to fetch:', e)
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  try {
    const config = await (window as any).config.getWeather()
    if (config.active && config.active.length > 0) {
      activeCities.value = config.active
      const pIdx = config.active.indexOf(config.primary)
      currentCityIndex.value = pIdx !== -1 ? pIdx : 0
      cityName.value = activeCities.value[currentCityIndex.value]
    } else if (config.primary) {
      cityName.value = config.primary
      activeCities.value = [config.primary]
    } else {
      cityName.value = 'Sin Ciudad'
    }
  } catch (e) {
    cityName.value = 'Desconocida'
  }

  await loadWeather(cityName.value)

  // Refresh every 20 minutes like the legacy app
  refreshTimer = setInterval(() => loadWeather(cityName.value), 20 * 60 * 1000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

async function switchCity(idx: number) {
  currentCityIndex.value = idx
  cityName.value = activeCities.value[idx]
  currentTemp.value = '—°'
  currentCondition.value = 'Cargando...'
  hourlyForecast.value = []
  dailyForecast.value = []
  await loadWeather(cityName.value)
}

function nextCity() {
  if (activeCities.value.length <= 1) return
  switchCity((currentCityIndex.value + 1) % activeCities.value.length)
}

function prevCity() {
  if (activeCities.value.length <= 1) return
  switchCity((currentCityIndex.value - 1 + activeCities.value.length) % activeCities.value.length)
}

function goBack() {
  router.push('/')
}

async function playTTS() {
  try {
    const text = `El tiempo en ${cityName.value} es de ${currentTemp.value} con ${currentCondition.value}. ${minTemp.value} y ${maxTemp.value}.`
    const buffer = await (window as any).config.ttsSpeak(text)
    if (buffer) {
      const audioCtx = new AudioContext()
      const decoded = await audioCtx.decodeAudioData(buffer)
      const source = audioCtx.createBufferSource()
      source.buffer = decoded
      source.connect(audioCtx.destination)
      source.start()
    }
  } catch (e) {
    console.error('TTS error:', e)
  }
}
</script>

<template>
  <div class="view-container">
    
    <!-- Top Header Area -->
    <div class="header-section">
      <div class="header-left">
        <div class="title">Tiempo</div>
        <div class="city-nav">
          <button v-if="activeCities.length > 1" class="nav-arrow" @click="prevCity">
            <img src="/images/arrowback.png" alt="Anterior" />
          </button>
          <div class="city-name">{{ cityName }}</div>
          <button v-if="activeCities.length > 1" class="nav-arrow" @click="nextCity">
            <img src="/images/arrowforward.png" alt="Siguiente" />
          </button>
        </div>
      </div>
      
      <div class="header-center">
        <div v-if="isLoading" class="loading-spinner" />
        <img v-else :src="currentIcon" alt="weather" class="main-weather-icon" />
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
      <div v-if="isLoading && hourlyForecast.length === 0" class="hourly-loading">
        Cargando previsión horaria...
      </div>
      <div v-else class="hourly-item" v-for="(hour, idx) in hourlyForecast" :key="idx">
        <div class="hour-time">{{ hour.time }}</div>
        <img :src="hour.icon" class="hour-icon" alt="hour weather" />
        <div class="hour-temp">{{ hour.temp }}</div>
      </div>
    </div>

    <!-- Daily Forecast Cards -->
    <div class="daily-section glass-panel">
      <div v-if="isLoading && dailyForecast.length === 0" class="daily-loading">
        Cargando previsión de la semana...
      </div>
      <div v-else class="daily-card" v-for="(day, idx) in dailyForecast" :key="idx">
        <div class="day-name">{{ day.name }}</div>
        <img :src="day.icon" class="day-icon" alt="daily weather" />
        <div class="day-precip">💧 {{ day.pop }}%</div>
        <div class="day-minmax">
          <div>{{ day.tmin }}</div>
          <div>{{ day.tmax }}</div>
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

.city-nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-top: 0.5rem;
}

.nav-arrow {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  transition: transform 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-arrow:active {
  transform: scale(0.9);
}

.nav-arrow img {
  width: 2.5rem;
  height: 2.5rem;
  object-fit: contain;
  opacity: 0.7;
}

.city-name {
  font-size: 5rem;
  font-weight: 800;
  color: #000;
  line-height: 1.1;
  margin-top: 0;
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

/* Loading states */
.loading-spinner {
  width: 5rem;
  height: 5rem;
  border: 5px solid rgba(0,0,0,0.1);
  border-top-color: #1E90FF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.hourly-loading,
.daily-loading {
  color: var(--text-secondary);
  font-size: 1.2rem;
  text-align: center;
  padding: 1rem;
  width: 100%;
}
</style>
