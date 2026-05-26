<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useVoiceAssistant } from '../composables/useVoiceAssistant'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t, locale } = useI18n()
const { speak: ttsSpeak } = useVoiceAssistant()

const cityName = ref(t('weather.loading'))
const currentTemp = ref('—°')
const currentCondition = ref(t('weather.loading'))
const minTemp = ref('Min —°')
const maxTemp = ref('Max —°')
const todayPop = ref(0)
const todayWind = ref(0)
const currentIcon = ref('/svg/nubes.svg')
const isLoading = ref(false)
const fullDate = ref('')

function updateFullDate() {
  const d = new Date()
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }
  const str = d.toLocaleDateString(locale.value, options)
  fullDate.value = str.charAt(0).toUpperCase() + str.slice(1)
}

const activeCities = ref<string[]>([])
const currentCityIndex = ref(0)

const hourlyForecast = ref<any[]>([])
const dailyForecast = ref<any[]>([])

let refreshTimer: ReturnType<typeof setInterval> | null = null

async function loadWeather(city: string) {
  if (!city || city === 'Sin Ciudad' || city === 'No City') return
  isLoading.value = true
  try {
    const bundle = await (window as any).config.fetchWeather(city, locale.value.split('-')[0])
    if (bundle) {
      currentTemp.value = bundle.temp
      currentCondition.value = bundle.description
      minTemp.value = bundle.tempMin
      maxTemp.value = bundle.tempMax
      todayPop.value = bundle.todayPop || 0
      todayWind.value = bundle.todayWind || 0
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
      cityName.value = locale.value === 'es' ? 'Sin Ciudad' : 'No City'
    }
  } catch (e) {
    cityName.value = locale.value === 'es' ? 'Desconocida' : 'Unknown'
  }

  await loadWeather(cityName.value)
  updateFullDate()

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
  currentCondition.value = t('weather.loading')
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



function triggerVoiceAssistant() {
  window.dispatchEvent(new CustomEvent('start-voice-assistant'))
}

function readWeatherReport() {
  const degreeWord = locale.value === 'es' ? ' grados' : locale.value === 'fr' ? ' degrés' : ' degrees'
  const cleanMax = maxTemp.value.replace(/[^\d-]/g, '') + degreeWord
  const cleanMin = minTemp.value.replace(/[^\d-]/g, '') + degreeWord
  const cleanCurrent = currentTemp.value.replace(/[^\d-]/g, '') + degreeWord
  
  const text = t('weather.report.intro', { city: cityName.value }) +
               t('weather.report.current', { condition: currentCondition.value, temp: cleanCurrent }) +
               t('weather.report.forecast', { max: cleanMax, min: cleanMin }) +
               t('weather.report.extra', { pop: todayPop.value, wind: todayWind.value })
               
  ttsSpeak(text)
}
</script>

<template>
  <div class="view-container">
    
    <!-- Top Panel: Header + Hourly -->
    <div class="top-panel glass-panel">
      <!-- Header Area -->
      <div class="header-section">
        
        <!-- Left Column: Title and City -->
        <div class="header-left">
          <div class="title">{{ t('weather.title') }}</div>
          <div class="city-name">{{ cityName }}</div>
          <div class="full-date">{{ fullDate }}</div>
        </div>
        
        <!-- Center Column: Icon, Temp, Condition -->
        <div class="header-center">
          <div v-if="isLoading" class="loading-spinner" />
          <template v-else>
            <img :src="currentIcon" alt="weather" class="main-weather-icon" />
            <div class="main-weather-info">
              <div class="main-temp">{{ currentTemp }}</div>
              <div class="main-desc">{{ currentCondition }}</div>
            </div>

            <div class="header-temps-column">
              <!-- Reusing styles from daily cards -->
              <div class="day-temps-row">
                <div class="temp-col">
                  <span class="temp-val">{{ minTemp.replace('Min ', '') }}</span>
                  <span class="temp-label">Min</span>
                </div>
                <div class="temp-divider"></div>
                <div class="temp-col">
                  <span class="temp-val">{{ maxTemp.replace('Max ', '') }}</span>
                  <span class="temp-label">Max</span>
                </div>
              </div>

              <div class="header-extra-info">
                <div>{{ t('weather.rain') }} <span class="extra-val">{{ todayPop }}%</span></div>
                <div>{{ t('weather.wind') }} <span class="extra-val">{{ todayWind }} km/h</span></div>
              </div>
            </div>
          </template>
        </div>

        <!-- Right Column: Hidden -->
        <div class="header-right" style="display: none;">
          <div class="min-max">
            <div>{{ minTemp }}</div>
            <div>{{ maxTemp }}</div>
          </div>
        </div>

        <!-- Actions Column: Buttons -->
        <div class="header-actions">
          <!-- Row 1: Back (positioned higher) -->
          <div class="action-row back-row">
            <button class="icon-button" @click="goBack">
              <img src="/images/back.png" :alt="t('weather.back')" class="icon" />
            </button>
          </div>

          <!-- Row 2: Voice & TTS -->
          <div class="action-row voice-row">
            <button class="icon-button" @click="readWeatherReport" :title="t('weather.read_title')">
              <img src="/svg/play.svg" :alt="t('weather.read_btn')" class="icon" style="width: 110%; height: 110%;" />
            </button>
            <button class="icon-button" @click="triggerVoiceAssistant">
              <img src="/svg/voice.svg" alt="Voice" class="icon" />
            </button>
          </div>

          <!-- Row 3: City Nav -->
          <div class="action-row nav-row" v-if="activeCities.length > 1">
            <button class="icon-button" @click="prevCity">
              <img src="/images/arrowback.png" :alt="t('weather.prev')" class="icon" />
            </button>
            <button class="icon-button" @click="nextCity">
              <img src="/images/arrowforward.png" :alt="t('weather.next')" class="icon" />
            </button>
          </div>
        </div>

      </div>

      <div class="divider"></div>

      <!-- Hourly Forecast Bar -->
      <div class="hourly-bar">
        <div v-if="isLoading && hourlyForecast.length === 0" class="hourly-loading">
          {{ t('weather.loading_hourly') }}
        </div>
        <div v-else class="hourly-item" v-for="(hour, idx) in hourlyForecast" :key="idx">
          <div class="hour-time">{{ hour.time }}</div>
          <img :src="hour.icon" class="hour-icon" alt="hour weather" />
          <div class="hour-temp">{{ hour.temp }}</div>
        </div>
      </div>
    </div>

    <!-- Bottom Panel: Daily Forecast -->
    <div class="bottom-panel glass-panel">
      <div v-if="isLoading && dailyForecast.length === 0" class="daily-loading">
        {{ t('weather.loading_weekly') }}
      </div>
      <div v-else class="daily-card" v-for="(day, idx) in dailyForecast" :key="idx">
        <div class="day-name-group">
          <div class="day-name">{{ day.name }}</div>
          <div class="day-date">{{ day.date }}</div>
        </div>
        <img :src="day.icon" class="day-icon" alt="daily weather" />
        
        <div class="day-temps-row">
          <div class="temp-col">
            <span class="temp-val">{{ day.tmin }}</span>
            <span class="temp-label">Min</span>
          </div>
          <div class="temp-divider"></div>
          <div class="temp-col">
            <span class="temp-val">{{ day.tmax }}</span>
            <span class="temp-label">Max</span>
          </div>
        </div>

        <div class="day-extra-info">
          <div>{{ t('weather.rain') }} <span class="extra-val">{{ day.pop !== undefined ? day.pop : 0 }}%</span></div>
          <div v-if="day.wind !== undefined">{{ t('weather.wind') }} <span class="extra-val">{{ day.wind }} km/h</span></div>
        </div>
      </div>
    </div>
    
  </div>
</template>

<style scoped>
.view-container {
  height: 100vh;
  padding: 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: hidden;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 20px;
}

/* Top Panel */
.top-panel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.5rem 2.5rem;
  flex: 1;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center; /* Centered vertically within the row */
  width: 100%;
  flex: 1; /* Occupy available space to allow vertical centering */
}

.header-left {
  display: flex;
  flex-direction: column;
  flex: 1;
  z-index: 1;
}

.title {
  font-size: 3rem;
  font-weight: 700;
  color: #111;
  line-height: 1;
}

.city-name {
  font-size: 6.5rem;
  font-weight: 800;
  color: #000;
  line-height: 1;
  margin-top: 1.5rem; 
}

.full-date {
  font-size: 2.2rem;
  font-weight: 500;
  color: #333;
  margin-top: 0.8rem;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 3.5rem;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 0;
}

.main-weather-icon {
  width: 10rem;
  height: 10rem;
  object-fit: contain;
}

.main-weather-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.main-temp {
  font-size: 6rem;
  font-weight: 800;
  color: #000;
  line-height: 1;
}

.main-desc {
  font-size: 2.2rem;
  font-weight: 500;
  color: #222;
  margin-top: 1rem; /* Increased margin */
}

.header-right {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
}

.header-temps-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.header-extra-info {
  display: flex;
  gap: 2rem;
  font-size: 1.6rem;
  color: #555;
}

.header-extra-info .extra-val {
  color: #000;
  font-weight: 700;
  font-size: 2rem;
}

.min-max {
  display: none;
}

.header-actions {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  align-items: flex-end;
  flex: 1;
  z-index: 1;
}

.action-row {
  display: flex;
  gap: 1rem;
}

.nav-row {
  margin-top: 3rem; /* Alejado de los otros botones */
  margin-bottom: -1.2rem; /* Cerca de la línea inferior */
}

.back-row {
  margin-top: -1rem; /* Pull up towards the top padding/margin */
  margin-bottom: 0.5rem;
}

.top-actions, .nav-actions {
  display: none;
}

.icon-button {
  width: 7.5rem;
  height: 7.5rem;
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
  width: 3.5rem; /* Increased 15% */
  height: 3.5rem; /* Increased 15% */
  object-fit: contain;
}

.divider {
  width: 100%;
  height: 1px;
  background: rgba(0, 0, 0, 0.15);
  margin: 1.5rem 0;
}

/* Hourly Bar */
.hourly-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0 1rem;
}

.hourly-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.hour-time {
  font-size: 1.3rem;
  font-weight: 600;
  color: #333;
}

.hour-icon {
  width: 4rem;
  height: 4rem;
  object-fit: contain;
}

.hour-temp {
  font-size: 1.5rem;
  font-weight: 700;
  color: #000;
}

/* Bottom Panel */
.bottom-panel {
  display: flex;
  justify-content: space-between;
  gap: 1.2rem;
  flex: 1;
  padding: 1.5rem;
}

.daily-card {
  flex: 1;
  background: white;
  border-radius: 16px;
  padding: 1.5rem 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  box-shadow: 0 4px 10px rgba(0,0,0,0.05);
}

.day-name-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  margin-bottom: 1.5rem;
}

.day-name {
  font-size: 2.7rem;
  font-weight: 700;
  color: #111;
}

.day-date {
  font-size: 2rem;
  font-weight: 500;
  color: #666;
}

.day-icon {
  width: 7.7rem; /* Increased 10% */
  height: 7.7rem; /* Increased 10% */
  object-fit: contain;
  margin-bottom: 3rem; /* Increased distance to percentage */
}

.day-extra-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.5rem; /* Reduced ~25% from 2rem */
  font-weight: 500;
  color: #666;
  margin-top: auto;
}

.extra-val {
  font-size: 2rem; /* Reduced ~25% from 2.6rem */
  font-weight: 700;
  color: #000;
}

.day-temps-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.temp-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.temp-val {
  font-size: 2.2rem;
  font-weight: 700;
  color: #111;
  line-height: 1;
}

.temp-label {
  font-size: 1.2rem;
  font-weight: 500;
  color: #888;
}

.temp-divider {
  width: 2rem;
  height: 2px;
  background-color: rgba(0,0,0,0.1);
  margin-bottom: 1.4rem; /* Align with values, ignoring labels */
}

/* Loading states */
.loading-spinner {
  width: 7.5rem;
  height: 7.5rem;
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
  color: #666;
  font-size: 1.2rem;
  text-align: center;
  padding: 1rem;
  width: 100%;
}
</style>
