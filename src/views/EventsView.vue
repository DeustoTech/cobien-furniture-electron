<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const currentDate = ref(new Date())
const eventsList = ref<any[]>([])
const selectedDate = ref<Date | null>(null)
const selectedEvents = ref<any[]>([])
const isModalOpen = ref(false)

onMounted(async () => {
  try {
    const data = await (window as any).config.getEvents()
    eventsList.value = data
  } catch (e) {
    console.error('Error loading events:', e)
  }
})

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
    days.push({ empty: true, date: 0, events: [] })
  }
  
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth() + 1
  const monthStr = month.toString().padStart(2, '0')
  
  // Actual days
  for (let i = 1; i <= daysInMonth.value; i++) {
    const dayStr = i.toString().padStart(2, '0')
    const dateToMatch = `${dayStr}-${monthStr}-${year}`
    
    // Find events matching this day
    const dayEvents = eventsList.value.filter(e => e.date === dateToMatch)
    
    days.push({ 
      empty: false, 
      date: i, 
      events: dayEvents,
      hasEvent: dayEvents.length > 0 
    })
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

function openDayModal(day: any) {
  if (day.empty || !day.hasEvent) return
  
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  selectedDate.value = new Date(year, month, day.date)
  selectedEvents.value = day.events
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
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
          @click="openDayModal(day)"
        >
          <template v-if="!day.empty">
            <span class="day-num">{{ day.date }}</span>
            <div v-if="day.hasEvent" class="dots-container">
              <span 
                v-for="(evt, i) in day.events.slice(0,3)" 
                :key="i" 
                class="event-dot"
                :style="{ backgroundColor: evt.color }"
              ></span>
              <span v-if="day.events.length > 3" class="more-dots">+</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Event Detail Modal -->
    <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content glass-panel">
        <div class="modal-header">
          <h2 class="modal-date">{{ selectedDate?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) }}</h2>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        
        <div class="events-list">
          <div v-for="evt in selectedEvents" :key="evt.id" class="event-card" :style="{ borderLeftColor: evt.color }">
            <div class="event-time" v-if="!evt.all_day">{{ evt.start_time }} <span v-if="evt.end_time">- {{ evt.end_time }}</span></div>
            <div class="event-time" v-else>Todo el día</div>
            <h3 class="event-title">{{ evt.title }}</h3>
            <p class="event-desc">{{ evt.description }}</p>
            <div class="event-footer">
              <span class="event-loc">📍 {{ evt.location }}</span>
              <span v-if="evt.audience === 'device'" class="event-badge">Privado</span>
            </div>
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

.calendar-card {
  flex: 1;
  border-radius: 20px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
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
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
}

.day-num {
  font-size: 2rem;
  font-weight: 600;
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

.dots-container {
  display: flex;
  gap: 4px;
  margin-top: 0.5rem;
}

.event-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.more-dots {
  font-size: 10px;
  line-height: 10px;
  color: var(--text-secondary);
  font-weight: bold;
}

/* Modal Styles */
.modal-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  border-radius: 20px;
}

.modal-content {
  width: 70%;
  max-height: 80%;
  border-radius: 20px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0,0,0,0.3);
  animation: modalIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes modalIn {
  from { transform: translateY(20px) scale(0.95); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid rgba(0,0,0,0.1);
  padding-bottom: 1rem;
}

.modal-date {
  font-size: 2rem;
  text-transform: capitalize;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2.5rem;
  cursor: pointer;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.close-btn:hover {
  color: var(--accent-red);
}

.events-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-right: 1rem;
}

.event-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  border-left: 6px solid #1E90FF;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.event-time {
  font-weight: 700;
  color: var(--text-secondary);
  font-size: 1.1rem;
}

.event-title {
  margin: 0;
  font-size: 1.6rem;
  color: var(--text-primary);
}

.event-desc {
  margin: 0;
  font-size: 1.2rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.event-footer {
  margin-top: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.1rem;
  color: var(--text-secondary);
}

.event-badge {
  background: #FF3B30;
  color: white;
  padding: 0.2rem 0.8rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: bold;
}
</style>
