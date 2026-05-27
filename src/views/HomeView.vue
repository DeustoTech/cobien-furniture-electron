<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import VolumePopup from '../components/VolumePopup.vue'
import BrightnessPopup from '../components/BrightnessPopup.vue'


const router = useRouter()
const { t, locale } = useI18n()


const currentDate = ref('')
const currentTime = ref('')
const weatherTemp = ref('17°')
const weatherCondition = ref('')
const weatherIcon = ref('/images/sol.png')
const cityName = ref(t('common.loading'))

const minTemp = ref('')
const maxTemp = ref('')
const nextEvent = ref(t('common.no_upcoming_events'))
const jokeText = ref('')
const systemMeta = ref('CoBien2 · v3.2.40')

// Reminder notification
const reminderActive = ref(false)
const reminderMessage = ref('')

let timer: number

onMounted(async () => {
  updateTime()
  timer = window.setInterval(updateTime, 1000)
  
  try {
    const sysInfo = await (window as any).config.getSystemInfo()
    systemMeta.value = `${sysInfo.deviceId} · v${sysInfo.version}`
  } catch(e) {}

  try {
    const config = await (window as any).config.getWeather()
    if (config.primary) {
      cityName.value = config.primary
    }
    const bundle = await (window as any).config.fetchWeather(cityName.value, locale.value.split('-')[0])
    if (bundle) {
      weatherTemp.value = bundle.temp
      weatherCondition.value = bundle.description
      weatherIcon.value = bundle.icon
      minTemp.value = bundle.tempMin
      maxTemp.value = bundle.tempMax
    }


  } catch(e) {}

  try {
    const events = await (window as any).config.getEvents()
    if (events && events.length > 0) {
      nextEvent.value = events[0].title
    }
  } catch(e) {}

  try {
    (window as any).config.onReminderFire((reminder: any) => {
      reminderMessage.value = reminder.message
      reminderActive.value = true
      const lang = locale.value.split('-')[0]
      ;(window as any).config.ttsSpeak(`${t('common.reminder_prefix')}${reminder.message}`, lang)
    })
  } catch(e) {}

  try {
    jokeText.value = await (window as any).config.getJoke(locale.value.split('-')[0])
  } catch(e) {}
})


onUnmounted(() => {
  clearInterval(timer)
})

function updateTime() {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit', hour12: false })
  currentDate.value = now.toLocaleDateString(locale.value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function handleNavigation(route: string) {
  router.push(route)
}

function triggerVoiceAssistant() {
  window.dispatchEvent(new Event('start-voice-assistant'))
}


const isVolumePopupOpen = ref(false)
const isBrightnessPopupOpen = ref(false)

async function openVolumePopup() {
  isVolumePopupOpen.value = true
}

async function openBrightnessPopup() {
  isBrightnessPopupOpen.value = true
}



</script>


<template>
  <div class="home-container">
    <div class="top-section">
      <div class="header-panel">
        
        <!-- Column 1: Time and Date -->
        <div class="header-col col-time">
          <div class="date-text">{{ currentDate }}</div>
          <div class="time-display">{{ currentTime }}</div>
        </div>

        <div class="v-separator"></div>

        <!-- Column 2: Weather -->
        <div class="header-col col-weather">
          <div class="weather-status">{{ weatherCondition }}</div>
          <div class="weather-main">
            <img :src="weatherIcon" class="weather-icon" alt="weather" />
            <div class="temp-group">

              <div class="current-temp">{{ weatherTemp }}</div>
              <div class="minmax-temp">
                <div>{{ minTemp }}</div>
                <div>{{ maxTemp }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="v-separator"></div>

        <!-- Column 3: Events & Joke -->
        <div class="header-col col-events">
          <div class="events-wrap">
            <div class="section-title">{{ t('home.next_events') }}</div>
            <div class="event-item">{{ nextEvent }}</div>
            <div class="section-title joke-title">{{ t('home.phrase_of_the_day') }}</div>
            <div class="joke-scroll-container">
              <div class="joke-text">{{ jokeText }}</div>
            </div>
          </div>

          
          <div class="top-right-actions">
            <button class="action-box" @click="handleNavigation('/admin-login')">
              <img src="/svg/settings.svg" alt="Settings" />
            </button>

            <button class="action-box" @click="triggerVoiceAssistant">
              <img src="/svg/voice.svg" alt="Voice" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation Grid 2x2 with Translucent Background -->
    <div class="nav-section">
      <div class="nav-grid">
        <button class="nav-card" @click="handleNavigation('/weather')">
          <img src="/svg/parcial.svg" class="nav-card-icon" alt="Weather" />
          <span class="nav-card-text">{{ t('home.weather') }}</span>
        </button>

        <button class="nav-card" @click="handleNavigation('/events')">
          <img src="/images/eventos.png" class="nav-card-icon" alt="Events" />
          <span class="nav-card-text">{{ t('home.events') }}</span>
        </button>

        <button class="nav-card" @click="handleNavigation('/board')">
          <img src="/svg/pizarra.svg" class="nav-card-icon" alt="Board" />
          <span class="nav-card-text">{{ t('home.board') }}</span>
        </button>

        <button class="nav-card" @click="handleNavigation('/call')">
          <img src="/images/videollamada.png" class="nav-card-icon" alt="Call Me" />
          <span class="nav-card-text">{{ t('home.call_me') }}</span>
        </button>
      </div>
    </div>



    <!-- Footer Controls -->
    <div class="footer-controls">
      <div class="footer-left">
        <button class="control-box" @click="openVolumePopup">
          <img src="/svg/volume.svg" alt="Volume" />
        </button>
        <button class="control-box" @click="openBrightnessPopup">
          <img src="/svg/brightness.svg" alt="Brightness" />
        </button>
      </div>

      <div class="system-tag">{{ systemMeta }}</div>
    </div>

    <!-- Hardware Popups -->
    <VolumePopup v-if="isVolumePopupOpen" @close="isVolumePopupOpen = false" />
    <BrightnessPopup v-if="isBrightnessPopupOpen" @close="isBrightnessPopupOpen = false" />



    <!-- Reminder Modal -->
    <Teleport to="body">
      <div v-if="reminderActive" class="reminder-overlay">
        <div class="reminder-card">
          <div class="reminder-icon">⏰</div>
          <h2 class="reminder-title">{{ t('common.reminder_prefix').trim().replace(':', '') }}</h2>
          <p class="reminder-msg">{{ reminderMessage }}</p>
          <button class="reminder-dismiss" @click="reminderActive = false">{{ t('common.ok') || 'OK' }}</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.home-container {
  height: 100vh;
  background: url('/images/Cobien_ImagenFondoInterfaz.png') no-repeat center center fixed;
  background-size: cover;
  display: flex;
  flex-direction: column;
  padding: 5rem 2.5rem 1.5rem; /* Increased top padding */

  gap: 1.5rem;
  overflow: hidden;
}

/* --- Header Panel --- */
.header-panel {
  width: 100%;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 28px;

  display: flex;
  min-height: 25vh;
  padding: 1.2rem 1.8rem;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}


.header-col {
  display: flex;
  flex-direction: column;
}

.v-separator {
  width: 1.5px;
  background: rgba(0, 0, 0, 0.15);
  margin: 1.2rem 0;
}

/* Col 1: Time & Date */
.col-time {
  flex: 1.2;
  align-items: center;
  text-align: center;
}

.date-text {
  font-size: 2rem; /* Matched to section-title */
  font-weight: 700;
  color: #111;
  margin-bottom: 0.5rem;
}

.time-display {
  font-size: clamp(5.1rem, 12vw, 12.7rem); /* Reduced by 15% */
  font-weight: 400; /* Removed bold */
  color: #000;
  line-height: 0.9;
  letter-spacing: -3px;
}

/* Col 2: Weather */
.col-weather {
  flex: 1;
  padding: 0 1.5rem;
}

.weather-status {
  font-size: 2rem; /* Matched to section-title */
  font-weight: 700;
  color: #111;
  margin-bottom: 1.2rem;
}

.weather-main {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.weather-icon {
  width: 12rem; /* Significantly increased */
  height: 12rem;
  object-fit: contain;
}


.current-temp {
  font-size: 7.5rem; /* Significantly increased */
  font-weight: 800;
  color: #000;
  line-height: 1;
}

.minmax-temp {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 2.2rem; /* Significantly increased */
  font-weight: 600;
  color: #444;
  margin-top: 0.2rem;
}

/* Col 3: Events & Joke */
.col-events {
  flex: 1.6;
  padding-left: 1.5rem;
  position: relative;
}

.section-title {
  font-size: 2rem;
  font-weight: 800;
  color: #111;
  margin-bottom: 0.4rem;
}

.joke-title {
  margin-top: 0.8rem;
}

.joke-scroll-container {
  flex: 1;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.joke-scroll-container::-webkit-scrollbar {
  width: 4px;
}

.joke-scroll-container::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.1);
  border-radius: 10px;
}

.event-item, .joke-text {
  font-size: 1.85rem;
  font-weight: 500;
  color: #333;
  line-height: 1.3;
}


.top-right-actions {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  gap: 0.8rem;
}

.action-box {
  width: 7.5rem;
  height: 7.5rem;

  background: white;
  border: 1.8px solid #000;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 8px rgba(0,0,0,0.06);
}

.action-box img {
  width: 4.8rem;
  height: 4.8rem;

  object-fit: contain;
}

.nav-section {
  background: rgba(255, 255, 255, 0.72);
  border-radius: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem; /* Halved padding */
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  backdrop-filter: blur(8px);
}

.nav-grid {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 1.5rem;
  justify-content: center;
  align-content: stretch;
}


.nav-card {
  display: flex;
  background: white;
  border: 2.2px solid rgba(0, 0, 0, 0.35);
  border-radius: 22px;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start; /* Aligned to the left */
  padding: 2.5rem 3rem; /* Increased vertical and horizontal padding */
  gap: 2.5rem; /* More gap for the larger icon */
  cursor: pointer;
  transition: transform 0.15s;
}


.nav-card:active {
  transform: scale(0.98);
}

.nav-card-icon {
  width: clamp(9.0rem, 17vw, 13.2rem); /* +20% larger */
  height: clamp(9.0rem, 17vw, 13.2rem);
  object-fit: contain;
  padding: 1.5rem; /* Increased padding as requested */
}

.nav-card-text {
  font-size: clamp(2.6rem, 5.5vw, 5.4rem);
  line-height: 1.1;
  text-align: center;


  font-weight: 700;
  color: #000;
}


/* --- Footer --- */
.footer-controls {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: auto;
}

.footer-left {
  display: flex;
  gap: 1.2rem;
}

.control-box {
  width: 7.5rem;
  height: 7.5rem;

  background: white;
  border: 1.8px solid #000;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.control-box img {
  width: 4.8rem;
  height: 4.8rem;

  object-fit: contain;
}

.system-tag {
  background: rgba(0, 0, 0, 0.4);
  color: white;
  padding: 0.4rem 1.4rem;
  border-radius: 100px;
  font-size: 1.1rem;
  font-weight: 700;
  backdrop-filter: blur(5px);
}

/* --- Reminder Modal --- */
.reminder-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.reminder-card {
  background: white;
  border-radius: 32px;
  padding: 3rem;
  width: 500px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  border: 3px solid #000;
}

.reminder-dismiss {
  background: #000;
  color: white;
  border: none;
  border-radius: 16px;
  padding: 1rem 3rem;
  font-size: 1.4rem;
  font-weight: 700;
  cursor: pointer;
}
</style>
