<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const cityName = ref('Bilbao')

function goBack() {
  router.push('/')
}
</script>

<template>
  <div class="view-container">
    <div class="header">
      <button class="back-button" @click="goBack">
        <img src="/images/back.png" alt="Volver" class="icon" v-if="false" />
        <span class="icon-placeholder">🔙</span>
        <span>Volver</span>
      </button>
      <div class="title">El tiempo en {{ cityName }}</div>
      <button class="voice-button">
        <img src="/images/voice.png" alt="Voice" class="icon" />
      </button>
    </div>

    <div class="content-grid">
      <!-- Tarjeta actual y horas -->
      <div class="glass-panel weather-card">
        <div class="current-weather">
          <img src="/images/sol.png" alt="Sol" class="large-icon" />
          <div class="current-info">
            <div class="temp">24°</div>
            <div class="desc">Soleado</div>
          </div>
        </div>
        <div class="hourly-forecast">
          <div class="hour-item">
            <span>12:00</span>
            <img src="/images/sol.png" class="small-icon" />
            <span>24°</span>
          </div>
          <div class="hour-item">
            <span>13:00</span>
            <img src="/images/sol.png" class="small-icon" />
            <span>25°</span>
          </div>
          <div class="hour-item">
            <span>14:00</span>
            <img src="/images/parcial.png" class="small-icon" />
            <span>25°</span>
          </div>
        </div>
      </div>

      <!-- Tarjeta predicción días -->
      <div class="glass-panel weather-card">
        <div class="forecast-title">Próximos Días</div>
        <div class="daily-forecast">
          <div class="day-item">
            <span>Jueves</span>
            <img src="/images/nubes.png" class="small-icon" />
            <span class="day-temps">Min 12° / Max 22°</span>
          </div>
          <div class="day-item">
            <span>Viernes</span>
            <img src="/images/lluvia.png" class="small-icon" />
            <span class="day-temps">Min 14° / Max 19°</span>
          </div>
          <div class="day-item">
            <span>Sábado</span>
            <img src="/images/sol.png" class="small-icon" />
            <span class="day-temps">Min 10° / Max 24°</span>
          </div>
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
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 3rem;
  font-weight: 700;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.6);
  padding: 0.5rem 2rem;
  border-radius: 20px;
  backdrop-filter: blur(10px);
}

.back-button, .voice-button {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 2rem;
  font-size: 1.5rem;
  font-weight: 600;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 15px;
  background: white;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s;
}

.back-button:active, .voice-button:active {
  transform: scale(0.95);
}

.icon {
  width: 2rem;
  height: 2rem;
  object-fit: contain;
}

.icon-placeholder {
  font-size: 2rem;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  flex: 1;
}

.weather-card {
  border-radius: 20px;
  padding: 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.current-weather {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid rgba(0,0,0,0.1);
}

.large-icon {
  width: 10rem;
  height: 10rem;
}

.current-info {
  display: flex;
  flex-direction: column;
}

.temp {
  font-size: 5rem;
  font-weight: 700;
  line-height: 1;
}

.desc {
  font-size: 2rem;
  color: var(--text-secondary);
}

.hourly-forecast {
  display: flex;
  justify-content: space-between;
  flex: 1;
}

.hour-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  font-size: 1.5rem;
  font-weight: 500;
}

.small-icon {
  width: 4rem;
  height: 4rem;
  object-fit: contain;
}

.forecast-title {
  font-size: 2rem;
  font-weight: 700;
  border-bottom: 1px solid rgba(0,0,0,0.1);
  padding-bottom: 1rem;
}

.daily-forecast {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  flex: 1;
  justify-content: space-around;
}

.day-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 1.8rem;
  font-weight: 500;
}

.day-temps {
  font-size: 1.4rem;
  color: var(--text-secondary);
}
</style>
