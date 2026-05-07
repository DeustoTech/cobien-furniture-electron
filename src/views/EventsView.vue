<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const currentDate = ref(new Date())
const nowTime = ref('')
const nowDate = ref('')
const eventsList = ref<any[]>([])
const selectedDate = ref<Date>(new Date())
const viewMode = ref<'calendar' | 'detail'>('calendar')
const isDeleteModalOpen = ref(false)
const eventToDelete = ref<any>(null)

const selectedEvents = computed(() => {
  const d = selectedDate.value
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const dateStr = `${day}-${month}-${d.getFullYear()}`
  return eventsList.value.filter(e => e.date === dateStr)
})

function updateClock() {
  const d = new Date()
  const optionsDate: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  const optionsTime: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
  
  const dateStr = d.toLocaleDateString('es-ES', optionsDate)
  nowDate.value = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
  nowTime.value = d.toLocaleTimeString('es-ES', optionsTime)
}

let clockTimer: ReturnType<typeof setInterval>

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
      await audioCtx.resume()
      
      // Handle potential Buffer/Uint8Array to ArrayBuffer conversion
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      const decoded = await audioCtx.decodeAudioData(arrayBuffer)
      const source = audioCtx.createBufferSource()
      source.buffer = decoded
      source.connect(audioCtx.destination)
      
      await new Promise<void>(resolve => {
        source.onended = () => {
          // Give 300ms buffer after speech ends
          setTimeout(resolve, 300)
        }
        source.start()
      })
    } else {
      await new Promise(r => setTimeout(r, 1500))
    }
  } catch(e) {
    console.error('TTS Playback Error:', e)
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
  const titleRaw = await listenWithVosk()
  if (!titleRaw) {
    voiceFlowMessage.value = '❌ No he entendido el título.'
    await speak('No he entendido el título.')
    await new Promise(r => setTimeout(r, 1500))
    voiceFlowActive.value = false; return
  }
  const title = titleRaw.trim().charAt(0).toUpperCase() + titleRaw.trim().slice(1)

  // Step 2: Confirm and Ask for description
  voiceFlowMessage.value = `✅ Título: "${title}"`
  await speak(`Título detectado: ${title}. Ahora dime la descripción del evento.`)
  voiceFlowMessage.value = '🎤 Di la descripción...'
  const descriptionRaw = await listenWithVosk()
  const description = descriptionRaw?.trim() || 'Sin descripción'

  // Step 3: Confirm both and Ask for location
  voiceFlowMessage.value = `✅ Título: "${title}"\n✅ Desc: "${description}"`
  await speak(`Título: ${title}. Descripción: ${description}. ¿Quieres añadir una localización al evento?`)
  
  voiceFlowMessage.value = '🎤 ¿Añadir localización? (Sí/No)'
  const wantLocation = await listenWithVosk()
  let location = ''
  
  if (wantLocation?.toLowerCase().includes('sí') || wantLocation?.toLowerCase().includes('si')) {
    await speak('Dime la localización.')
    voiceFlowMessage.value = '🎤 Di la localización...'
    const locRaw = await listenWithVosk()
    location = locRaw?.trim() || ''
    if (location) voiceFlowMessage.value += `\n📍 Loc: "${location}"`
  } else {
    await speak('De acuerdo.')
  }

  // Step 4: Save
  voiceFlowMessage.value = `💾 Guardando: "${title}"...`
  try {
    const ok = await (window as any).config.addPersonalEvent({
      date: dateStr,
      title,
      description,
      location
    })
    if (ok) {
      voiceFlowMessage.value = `🎉 Evento "${title}" guardado.`
      await speak(`De acuerdo, evento personal ${title} guardado.`)
      const data = await (window as any).config.getEvents()
      eventsList.value = data
    } else {
      voiceFlowMessage.value = '❌ Error al guardar.'
      await speak('Ha ocurrido un error al añadir el evento.')
    }
  } catch(e) {
    voiceFlowMessage.value = '❌ Error de base de datos.'
  }

  await new Promise(r => setTimeout(r, 2000))
  voiceFlowActive.value = false
  voiceFlowStep.value = 'idle'
}

function cancelVoiceFlow() {
  voiceFlowActive.value = false
  voiceFlowStep.value = 'idle'
}
// ──────────────────────────────────────────────────────────────────

onMounted(async () => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000 * 30) // update every 30s
  
  try {
    const data = await (window as any).config.getEvents()
    eventsList.value = data
  } catch (e) {
    console.error('Error loading events:', e)
  }
})

const currentMonthName = computed(() => {
  const month = currentDate.value.toLocaleDateString('es-ES', { month: 'long' })
  const year = currentDate.value.getFullYear()
  return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`
})

const selectedDateName = computed(() => {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  const str = selectedDate.value.toLocaleDateString('es-ES', options)
  return str.charAt(0).toUpperCase() + str.slice(1)
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
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const monthStr = (month + 1).toString().padStart(2, '0')
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  
  // Prev month
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = firstDayOfWeek.value - 1; i >= 0; i--) {
    days.push({ isOtherMonth: true, date: prevMonthLastDay - i, events: [] })
  }
  // Current month
  for (let i = 1; i <= daysInMonth.value; i++) {
    const dayStr = i.toString().padStart(2, '0')
    const dateToMatch = `${dayStr}-${monthStr}-${year}`
    const dayEvents = eventsList.value.filter(e => e.date === dateToMatch)
    days.push({ 
      isOtherMonth: false, 
      isToday: isCurrentMonth && today.getDate() === i, 
      date: i, 
      dateStr: dateToMatch, 
      events: dayEvents 
    })
  }
  // Next month
  if (days.length % 7 !== 0) {
    const remaining = 7 - (days.length % 7)
    for (let i = 1; i <= remaining; i++) {
      days.push({ isOtherMonth: true, date: i, events: [] })
    }
  }
  return days
})

const rowCount = computed(() => Math.ceil(calendarDays.value.length / 7))

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

function prevDay() {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() - 1)
  selectedDate.value = d
}

function nextDay() {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() + 1)
  selectedDate.value = d
}

function openDayDetail(day: any) {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  let d = day.date
  let m = month
  let y = year

  if (day.isOtherMonth) {
    if (d > 20) m--; else m++; // Simple logic for other month
  }
  
  selectedDate.value = new Date(y, m, d)
  viewMode.value = 'detail'
}

function closeDetail() {
  viewMode.value = 'calendar'
}

import { onUnmounted } from 'vue'
onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})
async function startVoiceEditFlow(event: any) {
  voiceFlowActive.value = true
  voiceFlowStep.value = 'speaking'

  await speak('¿Qué quieres editar: el título, la descripción, la localización o todo?')
  voiceFlowMessage.value = '🎤 ¿Qué quieres editar?'
  const choice = await listenWithVosk()
  const text = choice?.toLowerCase() || ''

  let newTitle = event.title
  let newDescription = event.description
  let newLocation = event.location

  const editAll = text.includes('todo')
  
  if (editAll || text.includes('título') || text.includes('titulo')) {
    await speak('Dime el nuevo título.')
    voiceFlowMessage.value = '🎤 Di el nuevo título...'
    const t = await listenWithVosk()
    if (t) newTitle = t.trim().charAt(0).toUpperCase() + t.trim().slice(1)
  }

  if (editAll || text.includes('descripción') || text.includes('descripcion')) {
    await speak('Dime la nueva descripción.')
    voiceFlowMessage.value = '🎤 Di la nueva descripción...'
    const d = await listenWithVosk()
    if (d) newDescription = d.trim()
  }

  if (editAll || text.includes('localización') || text.includes('localizacion') || text.includes('lugar')) {
    await speak('Dime la nueva localización.')
    voiceFlowMessage.value = '🎤 Di la nueva localización...'
    const l = await listenWithVosk()
    if (l) newLocation = l.trim()
  }

  voiceFlowMessage.value = '💾 Actualizando evento...'
  try {
    const ok = await (window as any).config.updatePersonalEvent({
      id: event.id,
      title: newTitle,
      description: newDescription,
      location: newLocation
    })
    if (ok) {
      voiceFlowMessage.value = '✅ Evento actualizado.'
      await speak('Evento actualizado correctamente.')
      const data = await (window as any).config.getEvents()
      eventsList.value = data
    } else {
      await speak('Error al actualizar.')
    }
  } catch(e) {
    voiceFlowMessage.value = '❌ Error de base de datos.'
  }

  await new Promise(r => setTimeout(r, 2000))
  voiceFlowActive.value = false
  voiceFlowStep.value = 'idle'
}

function openDeleteModal(event: any) {
  eventToDelete.value = event
  isDeleteModalOpen.value = true
}

function closeDeleteModal() {
  isDeleteModalOpen.value = false
  eventToDelete.value = null
}

async function confirmDelete() {
  if (!eventToDelete.value) return
  const ok = await (window as any).config.deleteEvent(eventToDelete.value.id)
  if (ok) {
    const data = await (window as any).config.getEvents()
    eventsList.value = data
    closeDeleteModal()
  }
}

async function deleteEvent(id: string) {
  // Keeping this for compatibility if needed elsewhere
  const ok = await (window as any).config.deleteEvent(id)
  if (ok) {
    const data = await (window as any).config.getEvents()
    eventsList.value = data
  }
}

function triggerVoiceAssistant() {
  window.dispatchEvent(new CustomEvent('start-voice-assistant'))
}

function goBack() {
  if (viewMode.value === 'detail') {
    closeDetail()
  } else {
    router.push('/')
  }
}
</script>

<template>
  <div class="view-container">
    <div class="header glass-panel">
      <div class="header-left">
        <h1 class="header-title">Calendario</h1>
        <div class="header-v-divider" v-if="viewMode === 'calendar'"></div>
        <div class="header-date-info" v-if="viewMode === 'calendar'">
          <div class="header-now-date">{{ nowDate }}</div>
          <div class="header-now-time">{{ nowTime }}</div>
        </div>
      </div>

      <div class="header-legend">
        <div class="legend-item">
          <span class="dot public"></span>
          <span>Público</span>
        </div>
        <div class="legend-item">
          <span class="dot personal"></span>
          <span>Personal</span>
        </div>
      </div>

      <div class="header-actions">
        <button class="square-action-btn" @click="triggerVoiceAssistant">
          <img src="/images/voice.png" alt="Voice" />
        </button>
        <div class="actions-spacer"></div>
        <button class="square-action-btn" @click="goBack">
          <img src="/images/back.png" alt="Volver" />
        </button>
      </div>
    </div>


    <div class="calendar-container" v-if="viewMode === 'calendar'">
      <button class="nav-arrow-side" @click="prevMonth">
        <img src="/images/arrowback.png" alt="Prev" />
      </button>

      <div class="glass-panel calendar-card">
        <div class="calendar-header">
          <div class="month-title">{{ currentMonthName }}</div>
        </div>

        <div class="calendar-grid" :class="{ 'six-rows': rowCount === 6 }">
          <!-- Weekdays -->
          <div class="weekday">Lunes</div>
          <div class="weekday">Martes</div>
          <div class="weekday">Miércoles</div>
          <div class="weekday">Jueves</div>
          <div class="weekday">Viernes</div>
          <div class="weekday">Sábado</div>
          <div class="weekday">Domingo</div>

          <!-- Days -->
          <div 
            v-for="(day, index) in calendarDays" 
            :key="index"
            :class="['day', { 'other-month': day.isOtherMonth, 'today': day.isToday }]"
            @click="openDayDetail(day)"
          >
            <span class="day-num">{{ day.date }}</span>
            <div class="dots-container">
              <span 
                v-for="(evt, i) in day.events.slice(0,3)" 
                :key="i" 
                :class="['event-dot', evt.audience === 'public' ? 'public' : 'personal']"
              ></span>
            </div>
          </div>
        </div>
      </div>

      <button class="nav-arrow-side" @click="nextMonth">
        <img src="/images/arrowforward.png" alt="Next" />
      </button>
    </div>

    <!-- Day Detail View -->
    <div class="calendar-container detail-view" v-else>
      <button class="nav-arrow-side" @click="prevDay">
        <img src="/images/arrowback.png" alt="Prev" />
      </button>

      <div class="glass-panel calendar-card detail-card">
        <div class="calendar-header">
          <div class="month-title">{{ selectedDateName }}</div>
        </div>

        <div class="detail-body">
          <div class="detail-actions">
            <button class="voice-add-btn-large" @click="startVoiceAddFlow((() => { const d = selectedDate!; const day = d.getDate().toString().padStart(2,'0'); const m = (d.getMonth()+1).toString().padStart(2,'0'); return `${day}-${m}-${d.getFullYear()}` })())">
              <img src="/images/plus.png" alt="+" />
              <span>Añadir evento personal (voz)</span>
            </button>
          </div>

          <div class="detail-events-list">
            <div v-for="evt in selectedEvents" :key="evt.id" class="event-card-horizontal" :class="evt.audience">
              <div class="event-bar" :class="evt.audience"></div>
              <div class="event-content">
                <div class="event-time-row" v-if="!evt.all_day">
                  <span class="e-time">{{ evt.start_time + (evt.end_time ? ' - ' + evt.end_time : '') }}</span>
                </div>
                <h3 class="e-title">{{ evt.title }}</h3>
                <p class="e-desc">{{ evt.description }}</p>
                <div class="e-footer">
                  <span class="e-loc" v-if="evt.location && evt.location.trim().length > 0">📍 {{ evt.location }}</span>
                  <span class="e-loc" v-else></span> <!-- Spacer -->
                  <div class="e-badges">
                    <span class="badge" :class="evt.audience">{{ evt.audience === 'device' ? 'Personal' : 'Público' }}</span>
                    <div class="e-actions-row" v-if="evt.audience === 'device'">
                      <button class="action-btn edit" @click="startVoiceEditFlow(evt)">
                        <img src="/images/edit.png" alt="Editar" />
                      </button>
                      <button class="action-btn delete" @click="openDeleteModal(evt)">
                        <img src="/images/trash.png" alt="Borrar" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="selectedEvents.length === 0" class="empty-state">
              No hay eventos para este día
            </div>
          </div>
        </div>
      </div>

      <button class="nav-arrow-side" @click="nextDay">
        <img src="/images/arrowforward.png" alt="Next" />
      </button>
    </div>

    <!-- Custom Delete Modal -->
    <Teleport to="body">
      <div v-if="isDeleteModalOpen" class="delete-modal-overlay" @click.self="closeDeleteModal">
        <div class="delete-modal-card glass-panel">
          <div class="delete-header">
            <img src="/images/trash.png" alt="!" class="delete-icon" />
            <h2>¿Eliminar evento?</h2>
          </div>
          <p class="delete-message">¿Estás seguro de que quieres eliminar el evento "<strong>{{ eventToDelete?.title }}</strong>"? Esta acción no se puede deshacer.</p>
          <div class="delete-footer">
            <button class="modal-btn cancel" @click="closeDeleteModal">Cancelar</button>
            <button class="modal-btn confirm-delete" @click="confirmDelete">Eliminar</button>
          </div>
        </div>
      </div>
    </Teleport>

    <div v-if="false" />

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
  padding: 1.5rem 2rem;
  border-radius: 20px;
}

.header-title {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0;
  color: #111;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.header-v-divider {
  width: 2px;
  height: 3rem;
  background: rgba(0,0,0,0.15);
}

.header-date-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.header-now-date {
  font-size: 2.4rem;
  font-weight: 700;
  color: #111;
}

.header-now-time {
  font-size: 2.0rem;
  font-weight: 600;
  color: #444;
}

.header-legend {
  display: flex;
  gap: 4rem;
  align-items: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  font-size: 2.2rem;
  font-weight: 700;
}

.dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}

.dot.public { background: #007AFF; }
.dot.personal { background: #FF3B30; }

.header-actions {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.actions-spacer {
  width: 2rem;
}


.square-action-btn {
  width: 4.5rem;
  height: 4.5rem;
  background: white;
  border: 2px solid #000;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.square-action-btn img {
  width: 2.5rem;
  height: 2.5rem;
}

.calendar-container {
  flex: 1;
  display: flex;
  align-items: stretch; /* Stretch children (the card) to fill height */
  gap: 1.5rem;
  min-height: 0; /* Allow shrinking if needed */
}

.calendar-card {
  flex: 1;
  border-radius: 24px;
  padding: 3rem;
  display: flex;
  flex-direction: column;
}

.calendar-header {
  display: flex;
  justify-content: center;
  margin-bottom: 3rem;
}

.month-title {
  font-size: 3rem;
  font-weight: 800;
  /* Removed capitalize to avoid "De Mayo" */
}

.nav-arrow-side {
  align-self: center; /* Keep arrows centered vertically while card stretches */
  background: white;
  border: 2px solid #000;
  border-radius: 12px;
  width: 5rem;
  height: 5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.nav-arrow-side img {
  width: 2.5rem;
  height: 2.5rem;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1.2rem;
  flex: 1;
}

.weekday {
  text-align: center;
  font-size: 1.6rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 1rem;
}

.day {
  background: white;
  border-radius: 14px;
  border: 2px solid #000;
  aspect-ratio: 1.4 / 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
}

.six-rows .day {
  aspect-ratio: 1.75 / 1; /* ~20% less tall than 1.4 */
}

.day-num {
  font-size: 2.2rem;
  font-weight: 700;
}

.day.other-month {
  background: rgba(255, 255, 255, 0.3);
  color: #666;
  border-color: rgba(0,0,0,0.3);
}

.day.today {
  background: #000;
  color: white;
  border-color: #000;
}

.dots-container {
  display: flex;
  gap: 8px;
  margin-top: 1rem;
}

.event-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.1);
}

.event-dot.public { background: #007AFF; }
.event-dot.personal { background: #FF3B30; }

/* Detail View Styles */
.detail-view .calendar-card {
  padding: 3.5rem;
  flex: 1; /* Ensure it fills the container height */
  display: flex;
  flex-direction: column;
}

.detail-body {
  flex: 1;
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 3rem;
  overflow: hidden;
}

.detail-actions {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.voice-add-btn-large {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1.5rem;
  background: white;
  border: 2px solid #000;
  border-radius: 16px;
  font-size: 1.6rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s;
}

.voice-add-btn-large:active { transform: scale(0.98); }

.voice-add-btn-large img {
  width: 2.5rem;
  height: 2.5rem;
}

.detail-events-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-right: 1rem;
}

.event-card-horizontal {
  background: white;
  border-radius: 18px;
  display: flex;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0,0,0,0.08);
  border: 1px solid rgba(0,0,0,0.05);
}

.event-bar {
  width: 10px;
}
.event-bar.public { background: #007AFF; }
.event-bar.device, .event-bar.personal { background: #FF3B30; }

.event-content {
  flex: 1;
  padding: 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.e-time {
  font-size: 1.2rem;
  font-weight: 700;
  color: #666;
}

.e-title {
  font-size: 2.1rem; /* +15% from 1.8 */
  font-weight: 800;
  margin: 0;
  color: #111;
}

.e-desc {
  font-size: 1.8rem; /* +40% from 1.3 */
  color: #333;
  margin: 0.5rem 0;
  line-height: 1.4;
}

.e-footer {
  margin-top: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.e-loc {
  font-size: 1.2rem;
  font-weight: 600;
  color: #666;
}

.e-badges {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.badge {
  padding: 0.4rem 1.2rem;
  border-radius: 20px;
  font-size: 1rem;
  font-weight: 800;
  color: white;
  text-transform: uppercase;
}

.badge.public { background: #007AFF; }
.badge.device, .badge.personal { background: #FF3B30; }

.e-actions-row {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.6rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn.edit {
  background: rgba(0, 0, 0, 0.05);
}

.action-btn.delete {
  background: rgba(255, 59, 48, 0.1);
  border: 2px solid #FF3B30;
}

.action-btn img {
  width: 2.8rem;
  height: 2.8rem;
}

.action-btn.delete img {
  filter: invert(27%) sepia(91%) saturate(7325%) hue-rotate(352deg) brightness(98%) contrast(106%);
}

.empty-state {
  text-align: center;
  padding: 5rem;
  font-size: 1.8rem;
  color: #999;
  font-weight: 600;
}

/* Scrollbar refinement */
.detail-events-list::-webkit-scrollbar {
  width: 8px;
}
.detail-events-list::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.05);
  border-radius: 4px;
}
.detail-events-list::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.2);
  border-radius: 4px;
}

/* Delete Modal */
.delete-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.delete-modal-card {
  width: 500px;
  padding: 3rem;
  border-radius: 28px;
  background: white;
  box-shadow: 0 30px 60px rgba(0,0,0,0.4);
  display: flex;
  flex-direction: column;
  gap: 2rem;
  text-align: center;
  animation: modalIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.delete-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.delete-icon {
  width: 80px;
  height: 80px;
  filter: invert(27%) sepia(91%) saturate(7325%) hue-rotate(352deg) brightness(98%) contrast(106%);
}

.delete-header h2 {
  font-size: 2.2rem;
  margin: 0;
  color: #111;
}

.delete-message {
  font-size: 1.5rem;
  color: #444;
  line-height: 1.5;
}

.delete-footer {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
}

.modal-btn {
  flex: 1;
  padding: 1.2rem;
  border-radius: 16px;
  font-size: 1.4rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: transform 0.2s;
}

.modal-btn:active { transform: scale(0.96); }

.modal-btn.cancel {
  background: #f0f0f0;
  color: #333;
}

.modal-btn.confirm-delete {
  background: #FF3B30;
  color: white;
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
