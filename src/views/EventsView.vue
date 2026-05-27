<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t, locale } = useI18n()

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
  const optionsTime: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false }
  
  const dateStr = d.toLocaleDateString(locale.value, optionsDate)
  nowDate.value = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
  nowTime.value = d.toLocaleTimeString(locale.value, optionsTime)
}

let clockTimer: ReturnType<typeof setInterval>

// ── Voice flow state ──────────────────────────────────────────────
const voiceFlowActive = ref(false)
const voiceFlowMessage = ref('')
const voiceFlowStep = ref<'idle' | 'listening' | 'speaking'>('idle')
const voiceTargetDay = ref<string>('') // DD-MM-YYYY

let globalAudioCtx: AudioContext | null = null
function getAudioCtx() {
  if (!globalAudioCtx) globalAudioCtx = new AudioContext()
  return globalAudioCtx
}

async function speak(text: string) {
  voiceFlowStep.value = 'speaking'
  voiceFlowMessage.value = text
  try {
    const lang = locale.value.split('-')[0]
    const buffer = await (window as any).config.ttsSpeak(text, lang)
    if (buffer) {
      const audioCtx = getAudioCtx()
      await audioCtx.resume()
      
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      const decoded = await audioCtx.decodeAudioData(arrayBuffer)
      const source = audioCtx.createBufferSource()
      source.buffer = decoded
      source.connect(audioCtx.destination)
      
      await new Promise<void>(resolve => {
        source.onended = () => {
          setTimeout(resolve, 500) // Increased delay to ensure audio is fully stopped
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

async function listenWithVosk(language: string = locale.value.split('-')[0]): Promise<string | null> {
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
  await speak(t('events.voice_flow.ask_title'))
  voiceFlowMessage.value = t('events.voice_flow.listening_title')
  const titleRaw = await listenWithVosk()
  if (!titleRaw) {
    voiceFlowMessage.value = t('events.voice_flow.not_understood_title')
    await speak(t('events.voice_flow.not_understood_title'))
    await new Promise(r => setTimeout(r, 1500))
    voiceFlowActive.value = false; return
  }
  const title = titleRaw.trim().charAt(0).toUpperCase() + titleRaw.trim().slice(1)

  // Step 2: Confirm and Ask for description
  voiceFlowMessage.value = `✅ ${t('events.voice_flow.title_label')}: "${title}"`
  await speak(t('events.voice_flow.ask_description', { title }))
  voiceFlowMessage.value = t('events.voice_flow.listening_description')
  const descriptionRaw = await listenWithVosk()
  const description = descriptionRaw?.trim() || t('events.voice_flow.no_description')

  // Step 3: Confirm both and Ask for location
  voiceFlowMessage.value = `✅ ${t('events.voice_flow.title_label')}: "${title}"\n✅ ${t('events.voice_flow.desc_label')}: "${description}"`
  await speak(t('events.voice_flow.ask_location_bool', { title, description }))
  
  voiceFlowMessage.value = t('events.voice_flow.listening_location_bool')
  const wantLocation = await listenWithVosk()
  let location = ''
  
  const yesWords = ['sí', 'si', 'yes', 'yeah', 'oui']
  if (yesWords.some(w => wantLocation?.toLowerCase().includes(w))) {
    await speak(t('events.voice_flow.ask_location'))
    voiceFlowMessage.value = t('events.voice_flow.listening_location')
    const locRaw = await listenWithVosk()
    location = locRaw?.trim() || ''
    if (location) voiceFlowMessage.value += `\n📍 ${t('events.voice_flow.loc_label')}: "${location}"`
  } else {
    await speak(t('events.voice_flow.ok'))
  }

  // Step 4: Save
  voiceFlowMessage.value = t('events.voice_flow.saving', { title })
  try {
    console.log(`[EVENTS] Saving event: "${title}" on ${dateStr}`)
    const ok = await (window as any).config.addPersonalEvent({
      date: dateStr,
      title,
      description,
      location
    })
    console.log(`[EVENTS] Save result:`, ok)
    if (ok) {
      voiceFlowMessage.value = `🎉 ${t('events.voice_flow.saved_label', { title })}`
      await speak(t('events.voice_flow.saved_success', { title }))
      const data = await (window as any).config.getEvents()
      eventsList.value = data
    } else {
      voiceFlowMessage.value = t('events.voice_flow.error_saving')
      await speak(t('events.voice_flow.error_saving'))
    }
  } catch(e) {
    voiceFlowMessage.value = t('events.voice_flow.error_db')
    await speak(t('events.voice_flow.error_db'))
  }

  await new Promise(r => setTimeout(r, 2000))
  voiceFlowActive.value = false
  voiceFlowStep.value = 'idle'
}

function cancelVoiceFlow() {
  voiceFlowActive.value = false
  voiceFlowStep.value = 'idle'
}

function startVoiceAdd() {
  const d = selectedDate.value
  const day = d.getDate().toString().padStart(2, '0')
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const dateStr = `${day}-${m}-${d.getFullYear()}`
  startVoiceAddFlow(dateStr)
}

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

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})

const currentMonthName = computed(() => {
  const month = currentDate.value.toLocaleDateString(locale.value, { month: 'long' })
  const year = currentDate.value.getFullYear()
  return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`
})

const selectedDateName = computed(() => {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  const str = selectedDate.value.toLocaleDateString(locale.value, options)
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
    if (d > 20) m--; else m++;
  }
  
  selectedDate.value = new Date(y, m, d)
  viewMode.value = 'detail'
}

function closeDetail() {
  viewMode.value = 'calendar'
}

async function startVoiceEditFlow(event: any) {
  voiceFlowActive.value = true
  voiceFlowStep.value = 'speaking'

  await speak(t('events.voice_flow.ask_edit_field'))
  voiceFlowMessage.value = t('events.voice_flow.listening_edit_field')
  const choice = await listenWithVosk()
  const text = choice?.toLowerCase() || ''

  let newTitle = event.title
  let newDescription = event.description
  let newLocation = event.location

  const editAll = text.includes('todo') || text.includes('everything') || text.includes('all')
  
  if (editAll || text.includes('título') || text.includes('titulo') || text.includes('title')) {
    await speak(t('events.voice_flow.ask_new_title'))
    voiceFlowMessage.value = t('events.voice_flow.listening_new_title')
    const tStr = await listenWithVosk()
    if (tStr) newTitle = tStr.trim().charAt(0).toUpperCase() + tStr.trim().slice(1)
  }

  if (editAll || text.includes('descripción') || text.includes('descripcion') || text.includes('description')) {
    await speak(t('events.voice_flow.ask_new_description'))
    voiceFlowMessage.value = t('events.voice_flow.listening_new_description')
    const d = await listenWithVosk()
    if (d) newDescription = d.trim()
  }

  if (editAll || text.includes('localización') || text.includes('localizacion') || text.includes('location') || text.includes('place')) {
    await speak(t('events.voice_flow.ask_new_location'))
    voiceFlowMessage.value = t('events.voice_flow.listening_new_location')
    const l = await listenWithVosk()
    if (l) newLocation = l.trim()
  }

  voiceFlowMessage.value = t('events.voice_flow.updating')
  try {
    const ok = await (window as any).config.updatePersonalEvent({
      id: event.id,
      title: newTitle,
      description: newDescription,
      location: newLocation
    })
    if (ok) {
      voiceFlowMessage.value = `✅ ${t('events.voice_flow.updated_success')}`
      await speak(t('events.voice_flow.updated_success'))
      const data = await (window as any).config.getEvents()
      eventsList.value = data
    } else {
      await speak(t('events.voice_flow.error_updating'))
    }
  } catch(e) {
    voiceFlowMessage.value = t('events.voice_flow.error_db')
    await speak(t('events.voice_flow.error_db'))
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
        <h1 class="header-title">{{ t('events.title') }}</h1>
        <div class="header-v-divider" v-if="viewMode === 'calendar'"></div>
        <div class="header-date-info" v-if="viewMode === 'calendar'">
          <div class="header-now-date">{{ nowDate }}</div>
          <div class="header-now-time">{{ nowTime }}</div>
        </div>
      </div>

      <div class="header-legend">
        <div class="legend-item">
          <span class="dot public"></span>
          <span>{{ t('events.public') }}</span>
        </div>
        <div class="legend-item">
          <span class="dot personal"></span>
          <span>{{ t('events.personal') }}</span>
        </div>
      </div>

      <div class="header-actions">
        <button class="square-action-btn" @click="triggerVoiceAssistant">
          <img src="/svg/voice.svg" :alt="t('events.voice')" />
        </button>
        <div class="actions-spacer"></div>
        <button class="square-action-btn" @click="goBack">
          <img src="/images/back.png" :alt="t('events.back')" />
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
          <div class="weekday">{{ t('events.monday') }}</div>
          <div class="weekday">{{ t('events.tuesday') }}</div>
          <div class="weekday">{{ t('events.wednesday') }}</div>
          <div class="weekday">{{ t('events.thursday') }}</div>
          <div class="weekday">{{ t('events.friday') }}</div>
          <div class="weekday">{{ t('events.saturday') }}</div>
          <div class="weekday">{{ t('events.sunday') }}</div>

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
            <button class="voice-add-btn-large" @click="startVoiceAdd">
              <img src="/svg/plus.svg" alt="+" />
              <span>{{ t('events.add_event_btn') }}</span>
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
                    <span class="badge" :class="evt.audience">{{ evt.audience === 'device' ? t('events.personal') : t('events.public') }}</span>
                    <div class="e-actions-row" v-if="evt.audience === 'device'">
                      <button class="action-btn edit" @click="startVoiceEditFlow(evt)">
                        <img src="/images/edit.png" alt="Edit" />
                      </button>
                      <button class="action-btn delete" @click="openDeleteModal(evt)">
                        <img src="/images/trash.png" alt="Delete" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="selectedEvents.length === 0" class="empty-state">
              {{ t('events.no_events') }}
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
            <h2>{{ t('events.delete_confirm_title') }}</h2>
          </div>
          <p class="delete-message">{{ t('events.delete_confirm_msg', { title: eventToDelete?.title }) }}</p>
          <div class="delete-footer">
            <button class="modal-btn cancel" @click="closeDeleteModal">{{ t('events.cancel_btn') }}</button>
            <button class="modal-btn confirm-delete" @click="confirmDelete">{{ t('events.delete_btn') }}</button>
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
            <img src="/svg/voice.svg" alt="voice" class="voice-icon-large" />
            <h2>{{ t('events.voice_assistant_title') }}</h2>
          </div>

          <div class="voice-modal-body">
            <div class="voice-status-indicator" :class="voiceFlowStep">
              <div v-if="voiceFlowStep === 'listening'" class="pulse-ring" />
              <div v-if="voiceFlowStep === 'speaking'" class="wave-icon">🔊</div>
            </div>
            <p class="voice-message">{{ voiceFlowMessage }}</p>
          </div>

          <div class="voice-modal-footer">
            <button class="cancel-voice-btn" @click="cancelVoiceFlow">{{ t('events.cancel_btn') }}</button>
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
  align-items: stretch;
  gap: 1.5rem;
  min-height: 0;
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
}

.nav-arrow-side {
  align-self: center;
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
  grid-template-rows: auto repeat(5, 1fr);
  gap: 1rem;
  flex: 1;
  min-height: 0;
}

.six-rows .calendar-grid {
  grid-template-rows: auto repeat(6, 1fr);
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
  min-height: 0;
  height: 100%;
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
  flex: 1;
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
  background: #000;
  color: white;
  border: none;
  border-radius: 20px;
  padding: 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  cursor: pointer;
  transition: transform 0.2s;
}

.voice-add-btn-large:active {
  transform: scale(0.96);
}

.voice-add-btn-large img {
  width: 6rem;
  height: 6rem;
  filter: invert(1);
}

.voice-add-btn-large span {
  font-size: 1.8rem;
  font-weight: 800;
  text-align: center;
  line-height: 1.2;
}

.detail-events-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-right: 1rem;
}

.detail-events-list::-webkit-scrollbar {
  width: 6px;
}
.detail-events-list::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.1);
  border-radius: 10px;
}

.event-card-horizontal {
  background: white;
  border-radius: 20px;
  border: 2px solid #000;
  display: flex;
  overflow: hidden;
  min-height: 14rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.event-bar {
  width: 14px;
}
.event-bar.public, .badge.public { background: #007AFF; }
.event-bar.device, .badge.device, .event-bar.personal, .badge.personal { background: #FF3B30; }

.event-content {
  flex: 1;
  padding: 1.5rem 2.5rem;
  display: flex;
  flex-direction: column;
}

.event-time-row {
  margin-bottom: 0.5rem;
}
.e-time {
  font-size: 1.6rem;
  font-weight: 800;
  color: #666;
}

.e-title {
  font-size: 2.2rem;
  font-weight: 900;
  margin: 0 0 0.5rem 0;
  color: #000;
}

.e-desc {
  font-size: 1.6rem;
  color: #444;
  margin: 0;
  line-height: 1.4;
  flex: 1;
}

.e-footer {
  margin-top: 1.2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.e-loc {
  font-size: 1.5rem;
  font-weight: 600;
  color: #555;
}

.e-badges {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.badge {
  color: white;
  padding: 0.4rem 1.2rem;
  border-radius: 100px;
  font-size: 1.3rem;
  font-weight: 700;
  text-transform: uppercase;
}

.e-actions-row {
  display: flex;
  gap: 0.8rem;
}

.action-btn {
  width: 4rem;
  height: 4rem;
  border-radius: 10px;
  border: 1.5px solid #000;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
}
.action-btn:active { transform: scale(0.9); }
.action-btn img { width: 2rem; height: 2rem; }

.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  font-weight: 700;
  color: #999;
}

/* Delete Modal */
.delete-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.delete-modal-card {
  width: 550px;
  background: white;
  border-radius: 32px;
  padding: 3rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  border: 3px solid #000;
  box-shadow: 0 30px 60px rgba(0,0,0,0.3);
}

.delete-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.delete-icon { width: 4rem; height: 4rem; }
.delete-header h2 { font-size: 2.2rem; font-weight: 900; margin: 0; }

.delete-message {
  font-size: 1.6rem;
  line-height: 1.5;
  color: #333;
}

.delete-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1.5rem;
  margin-top: 1rem;
}

.modal-btn {
  padding: 1rem 2.5rem;
  border-radius: 14px;
  font-size: 1.4rem;
  font-weight: 800;
  cursor: pointer;
  border: 2px solid #000;
}
.modal-btn.cancel { background: white; color: #000; }
.modal-btn.confirm-delete { background: #FF3B30; color: white; border-color: #FF3B30; }

/* Voice Modal */
.voice-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  backdrop-filter: blur(8px);
}

.voice-modal-card {
  width: 500px;
  background: white;
  border-radius: 35px;
  padding: 3rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  border: 4px solid #000;
}

.voice-modal-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.voice-icon-large { width: 7rem; height: 7rem; }
.voice-modal-header h2 { font-size: 2.2rem; font-weight: 900; margin: 0; }

.voice-modal-body {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

.voice-status-indicator {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.voice-status-indicator.listening { background: #E3F2FD; }
.voice-status-indicator.speaking { background: #F3E5F5; }

.pulse-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 4px solid #1E90FF;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}

.wave-icon { font-size: 3rem; }

.voice-message {
  font-size: 1.8rem;
  font-weight: 700;
  text-align: center;
  color: #333;
  min-height: 5rem;
}

.cancel-voice-btn {
  background: #eee;
  color: #000;
  border: none;
  border-radius: 15px;
  padding: 0.8rem 2.5rem;
  font-size: 1.2rem;
  font-weight: 800;
  cursor: pointer;
}
</style>
