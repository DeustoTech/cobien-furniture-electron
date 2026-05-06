<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const currentDate = ref(new Date())

const currentMonthName = computed(() => {
  return currentDate.value.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
})

const daysInMonth = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  return new Date(year, month + 1, 0).getDate()
})

const firstDayOfWeek = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  let day = new Date(year, month, 1).getDay()
  // Adjust so Monday is 0, Sunday is 6
  return day === 0 ? 6 : day - 1
})

const calendarDays = computed(() => {
  const days = []
  // Empty slots before the 1st
  for (let i = 0; i < firstDayOfWeek.value; i++) {
    days.push({ empty: true, date: 0 })
  }
  // Actual days
  for (let i = 1; i <= daysInMonth.value; i++) {
    days.push({ empty: false, date: i, hasEvent: i === 6 || i === 15 }) // Dummy events
  }
  return days
})

function prevMonth() {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() - 1)
  currentDate.value = newDate
}

function nextMonth() {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() + 1)
  currentDate.value = newDate
}

function goBack() {
  router.push('/')
}
</script>

<template>
  <div class="view-container">
    <div class="header">
      <button class="back-button" @click="goBack">
        <span class="icon-placeholder">🔙</span>
        <span>Volver</span>
      </button>
      <div class="title">Eventos</div>
      <button class="voice-button">
        <img src="/images/voice.png" alt="Voice" class="icon" />
      </button>
    </div>

    <div class="glass-panel calendar-card">
      <div class="calendar-header">
        <button class="nav-arrow" @click="prevMonth">◀</button>
        <div class="month-title">{{ currentMonthName }}</div>
        <button class="nav-arrow" @click="nextMonth">▶</button>
      </div>

      <div class="calendar-grid">
        <!-- Weekdays -->
        <div class="weekday">L</div>
        <div class="weekday">M</div>
        <div class="weekday">X</div>
        <div class="weekday">J</div>
        <div class="weekday">V</div>
        <div class="weekday">S</div>
        <div class="weekday">D</div>

        <!-- Days -->
        <div 
          v-for="(day, index) in calendarDays" 
          :key="index"
          :class="['day', { empty: day.empty, active: day.hasEvent }]"
        >
          <template v-if="!day.empty">
            {{ day.date }}
            <span v-if="day.hasEvent" class="event-dot"></span>
          </template>
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

.calendar-card {
  flex: 1;
  border-radius: 20px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 0 2rem;
}

.month-title {
  font-size: 2.5rem;
  font-weight: 700;
  text-transform: capitalize;
}

.nav-arrow {
  font-size: 2rem;
  background: white;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 10px;
  width: 4rem;
  height: 4rem;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1rem;
  flex: 1;
}

.weekday {
  text-align: center;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.day {
  background: rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 1rem;
  font-size: 2rem;
  font-weight: 600;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
}

.day:not(.empty):hover {
  background: white;
  box-shadow: var(--shadow-sm);
}

.day.empty {
  background: transparent;
  border: none;
  cursor: default;
}

.day.active {
  background: white;
  border: 2px solid var(--accent-blue);
  box-shadow: var(--shadow-md);
}

.event-dot {
  width: 10px;
  height: 10px;
  background-color: var(--accent-red);
  border-radius: 50%;
  margin-top: 0.5rem;
}
</style>
