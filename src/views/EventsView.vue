<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const currentDate = ref(new Date())
const eventsList = ref<any[]>([])
const selectedDate = ref<Date | null>(null)
const selectedEvents = ref<any[]>([])
const isModalOpen = ref(false)

// ── Voice flow state ──────────────────────────────────────────────
const voiceFlowActive = ref(false)
const voiceFlowMessage = ref('')
const voiceFlowStep = ref<'idle' | 'listening' | 'speaking'>('idle')
const voiceTargetDay = ref<string>('') // DD-MM-YYYY

async function speak(text: string) {
  voiceFlowStep.value = 'speaking'
  voiceFlowMessage.value = text
  try {
    const buffer = await (window as any).config.ttsSpeak(text)
    if (buffer) {
      const audioCtx = new AudioContext()
      const decoded = await audioCtx.decodeAudioData(buffer)
      const source = audioCtx.createBufferSource()
      source.buffer = decoded
      source.connect(audioCtx.destination)
      await new Promise<void>(resolve => {
        source.onended = () => resolve()
        source.start()
      })
    } else {
      // Fallback: small delay to simulate speech
      await new Promise(r => setTimeout(r, 1500))
    }
  } catch(e) {
    await new Promise(r => setTimeout(r, 1500))
  }
}

async function listenWithVosk(language: string = 'es'): Promise<string | null> {
  voiceFlowStep.value = 'listening'
  try {
    const text = await (window as any).config.sttListen(language)
    return text || null
  } catch (e) {
    console.error('STT Error:', e)
    return null
  }
}

async function startVoiceAddFlow(dateStr: string) {
  voiceTargetDay.value = dateStr
  voiceFlowActive.value = true
  voiceFlowStep.value = 'speaking'

  // Step 1: Ask for title
  await speak('Dime el título del evento personal')
  voiceFlowMessage.value = '🎤 Di el título del evento...'
  const title = await listenWithVosk()

  if (!title) {
    voiceFlowMessage.value = '❌ No he entendido el título. Inténtalo de nuevo.'
    await speak('No he entendido el título.')
    await new Promise(r => setTimeout(r, 1500))
    voiceFlowActive.value = false
    voiceFlowStep.value = 'idle'
    return
  }

  voiceFlowMessage.value = `✅ Título: "${title}"\n\nAhora di la descripción...`
  await speak(`Título detectado: ${title}. Ahora dime la descripción del evento.`)

  // Step 2: Ask for description
  voiceFlowMessage.value = '🎤 Di la descripción del evento...'
  const description = await listenWithVosk()
  const descFinal = description?.trim() || 'Sin descripción'

  voiceFlowMessage.value = `✅ Descripción: "${descFinal}"\n\nGuardando evento...`
  await speak(`Descripción detectada: ${descFinal}. Guardando evento.`)

  // Step 3: Save
  try {
    const ok = await (window as any).config.addPersonalEvent({
      date: dateStr,
      title: title.trim(),
      description: descFinal
    })
    if (ok) {
      voiceFlowMessage.value = '🎉 ¡Evento guardado correctamente!'
      await speak('Evento añadido correctamente.')
      // Reload events
      const data = await (window as any).config.getEvents()
      eventsList.value = data
    } else {
      voiceFlowMessage.value = '❌ Ha ocurrido un error al guardar el evento.'
      await speak('Ha ocurrido un error al añadir el evento.')
    }
  } catch(e) {
    voiceFlowMessage.value = '❌ Error de conexión con la base de datos.'
  }

  await new Promise(r => setTimeout(r, 1800))
  voiceFlowActive.value = false
  voiceFlowStep.value = 'idle'
}

function cancelVoiceFlow() {
  voiceFlowActive.value = false
  voiceFlowStep.value = 'idle'
}
// ──────────────────────────────────────────────────────────────────

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
  return day === 0 ? 6 : day - 1
})

const calendarDays = computed(() => {
  const days = []
  for (let i = 0; i < firstDayOfWeek.value; i++) {
    days.push({ empty: true, date: 0, events: [], dateStr: '' })
  }
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth() + 1
  const monthStr = month.toString().padStart(2, '0')
  for (let i = 1; i <= daysInMonth.value; i++) {
    const dayStr = i.toString().padStart(2, '0')
    const dateToMatch = `${dayStr}-${monthStr}-${year}`
    const dayEvents = eventsList.value.filter(e => e.date === dateToMatch)
    days.push({ 
      empty: false, 
      date: i, 
      dateStr: dateToMatch,
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
  if (day.empty) return
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  selectedDate.value = new Date(year, month, day.date)
  selectedEvents.value = day.events
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
}

async function deleteEvent(id: string) {
  if (confirm('¿Seguro que quieres eliminar este evento personal?')) {
    const ok = await (window as any).config.deleteEvent(id)
    if (ok) {
      selectedEvents.value = selectedEvents.value.filter(e => e.id !== id)
      // Refresh global list
      const data = await (window as any).config.getEvents()
      eventsList.value = data
    }
  }
}

function triggerVoiceAssistant() {
  window.dispatchEvent(new CustomEvent('start-voice-assistant'))
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
      <button class="voice-button" @click="triggerVoiceAssistant">
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
          <div class="modal-actions">
            <button 
              v-if="selectedDate"
              class="voice-add-btn"
              @click="closeModal(); startVoiceAddFlow((() => { const d = selectedDate!; const day = d.getDate().toString().padStart(2,'0'); const m = (d.getMonth()+1).toString().padStart(2,'0'); return `${day}-${m}-${d.getFullYear()}` })()); "
            >
              <img src="/images/plus.png" alt="+" class="btn-icon" />
              <img src="/images/voice.png" alt="voz" class="btn-icon" />
              <span>Añadir evento</span>
            </button>
            <button class="close-btn" @click="closeModal">✕</button>
          </div>
        </div>
        
        <div class="events-list">
          <div v-for="evt in selectedEvents" :key="evt.id" class="event-card" :style="{ borderLeftColor: evt.color }">
            <div class="event-time" v-if="!evt.all_day">{{ evt.start_time }} <span v-if="evt.end_time">- {{ evt.end_time }}</span></div>
            <div class="event-time" v-else>Todo el día</div>
            <h3 class="event-title">{{ evt.title }}</h3>
            <p class="event-desc">{{ evt.description }}</p>
            <div class="event-footer">
              <span class="event-loc">📍 {{ evt.location }}</span>
              <div class="event-badges">
                <span v-if="evt.audience === 'device'" class="event-badge personal">Personal</span>
                <button v-if="evt.audience === 'device'" class="delete-msg-btn" @click="deleteEvent(evt.id)">
                  <img src="/images/trash.png" alt="Borrar" class="btn-icon-vsmall" />
                </button>
              </div>
            </div>
          </div>
          <div v-if="selectedEvents.length === 0" class="no-events-hint">No hay eventos este día todavía.</div>
        </div>

        <!-- Shortcut: tap anywhere on empty day also shows add button -->
        <div class="modal-footer-add">
          <button 
            v-if="selectedDate"
            class="voice-add-btn-full"
            @click="closeModal(); startVoiceAddFlow((() => { const d = selectedDate!; const day = d.getDate().toString().padStart(2,'0'); const m = (d.getMonth()+1).toString().padStart(2,'0'); return `${day}-${m}-${d.getFullYear()}` })()); "
          >
            <img src="/images/plus.png" alt="+" class="btn-icon" />
            <img src="/images/voice.png" alt="voz" class="btn-icon" />
            <span>Añadir evento personal por voz</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Day click with no events: open modal to allow adding -->
    <!-- Any day (even empty) is clickable now for voice add -->
    <div v-if="!isModalOpen" style="display:none" />

    <!-- ── Voice Flow Modal ───────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="voiceFlowActive" class="voice-modal-overlay">
        <div class="voice-modal-card">
          <div class="voice-modal-header">
            <img src="/images/voice.png" alt="voz" class="voice-icon-large" />
            <h2>Asistente de Voz</h2>
          </div>

          <div class="voice-modal-body">
            <div class="voice-status-indicator" :class="voiceFlowStep">
              <div v-if="voiceFlowStep === 'listening'" class="pulse-ring" />
              <div v-if="voiceFlowStep === 'speaking'" class="wave-icon">🔊</div>
            </div>
            <p class="voice-message">{{ voiceFlowMessage }}</p>
          </div>

          <div class="voice-modal-footer">
            <button class="cancel-voice-btn" @click="cancelVoiceFlow">Cancelar</button>
          </div>
        </div>
      </div>
    </Teleport>
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
  color: white;
  padding: 0.2rem 0.8rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: bold;
}

.event-badge.personal {
  background: #FF3B30;
}

.event-badges {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.delete-msg-btn {
  background: none;
  border: none;
  font-size: 1.8rem;
  cursor: pointer;
  color: #888;
  padding: 0.4rem;
  border-radius: 8px;
  transition: all 0.2s;
}

.delete-msg-btn:hover {
  background: #fff0f0;
  color: #ff3b30;
}

.btn-icon-vsmall {
  width: 1.8rem;
  height: 1.8rem;
  object-fit: contain;
}

/* Modal actions row */
.modal-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* Voice add button in modal header */
.voice-add-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #1E90FF, #0066cc);
  color: white;
  border: none;
  border-radius: 14px;
  padding: 0.6rem 1.2rem;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.4);
}

.voice-add-btn:active {
  transform: scale(0.95);
}

/* Voice add full-width button at modal bottom */
.modal-footer-add {
  margin-top: 1.5rem;
  border-top: 1px solid rgba(0,0,0,0.08);
  padding-top: 1rem;
}

.voice-add-btn-full {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  width: 100%;
  background: linear-gradient(135deg, #2196F3, #1565C0);
  color: white;
  border: none;
  border-radius: 16px;
  padding: 1rem;
  font-size: 1.3rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 6px 20px rgba(33, 150, 243, 0.5);
}

.voice-add-btn-full:active {
  transform: scale(0.97);
}

.btn-icon {
  width: 2rem;
  height: 2rem;
  object-fit: contain;
}

.no-events-hint {
  text-align: center;
  color: var(--text-secondary);
  font-size: 1.2rem;
  padding: 2rem 0;
}

/* ── Voice Flow Modal ─────────────────────────────────────────────── */
.voice-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.voice-modal-card {
  background: rgba(255, 255, 255, 0.97);
  border-radius: 28px;
  padding: 3rem 3.5rem;
  width: min(650px, 90vw);
  display: flex;
  flex-direction: column;
  gap: 2rem;
  box-shadow: 0 30px 80px rgba(0,0,0,0.35);
  animation: voiceModalIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes voiceModalIn {
  from { transform: scale(0.85) translateY(30px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

.voice-modal-header {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  border-bottom: 1px solid rgba(0,0,0,0.1);
  padding-bottom: 1.5rem;
}

.voice-modal-header h2 {
  font-size: 2rem;
  font-weight: 800;
  color: #111;
  margin: 0;
}

.voice-icon-large {
  width: 3.5rem;
  height: 3.5rem;
  object-fit: contain;
}

.voice-modal-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  min-height: 120px;
}

.voice-status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
}

.wave-icon {
  font-size: 3rem;
  animation: wavePulse 1s ease-in-out infinite alternate;
}

@keyframes wavePulse {
  from { transform: scale(1); }
  to { transform: scale(1.3); }
}

/* Listening pulse ring */
.pulse-ring {
  width: 60px;
  height: 60px;
  border: 5px solid #1E90FF;
  border-radius: 50%;
  animation: pulseRing 1s ease-out infinite;
}

@keyframes pulseRing {
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}

.voice-message {
  font-size: 1.5rem;
  color: #222;
  text-align: center;
  line-height: 1.6;
  white-space: pre-line;
  font-weight: 500;
  margin: 0;
}

.voice-modal-footer {
  display: flex;
  justify-content: center;
}

.cancel-voice-btn {
  background: rgba(0,0,0,0.07);
  border: none;
  border-radius: 14px;
  padding: 0.8rem 2.5rem;
  font-size: 1.2rem;
  font-weight: 600;
  color: #555;
  cursor: pointer;
  transition: background 0.2s;
}

.cancel-voice-btn:hover {
  background: rgba(255, 59, 48, 0.15);
  color: #FF3B30;
}
</style>
