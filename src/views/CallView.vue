<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMissedCalls } from '../composables/useMissedCalls'

const router = useRouter()
const { t, locale } = useI18n()
const { missedCalls, removeMissedCall } = useMissedCalls()

interface Contact {
  displayName: string
  userName: string
  imagePath: string
  callable: boolean
}

const contacts = ref<Contact[]>([])
const callStatus = ref<'idle' | 'sending' | 'sent' | 'error'>('idle')
const callMessage = ref('')
const callingContact = ref<Contact | null>(null)
const contactsPath = ref('list_contacts.txt')

// Clock for the header
const currentTime = ref(new Date())
let clockTimer: any = null

onMounted(async () => {
  try {
    const sysInfo = await (window as any).config.getSystemInfo()
    if (sysInfo && sysInfo.contactsPath) {
      contactsPath.value = sysInfo.contactsPath
    }
  } catch (e) {
    console.error('Error fetching system info contacts path:', e)
  }

  try {
    const fetched = await (window as any).config.getContacts()
    
    // Add 6 mock contacts to test scroll and landscapes
    const mockNames = ['Javier R.', 'Elena M.', 'Pedro G.', 'Lucía F.', 'Marcos T.', 'Sonia V.']
    const mockContacts = mockNames.map((name, i) => ({
      displayName: name,
      userName: `user_${i}`,
      imagePath: '', // No photo, will use landscape
      callable: true
    }))

    contacts.value = [
      ...fetched,
      ...mockContacts
    ]
  } catch (e) {
    console.error('[CONTACTS] Error loading:', e)
  }

  clockTimer = setInterval(() => {
    currentTime.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})

const formattedDate = computed(() => {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  const str = currentTime.value.toLocaleDateString(locale.value, options)
  return str.charAt(0).toUpperCase() + str.slice(1)
})

const latestMissedCall = computed(() => missedCalls.value[0] || null)

const formattedTime = computed(() => {
  return currentTime.value.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit', hour12: false })
})

function getImageUrl(contact: Contact, index: number): string {
  if (contact.imagePath) return `cobien-media://${contact.imagePath}`
  // Cycle through 5 landscapes
  const landscapeId = (index % 5) + 1
  return `/images/landscape_${landscapeId}.png`
}

async function requestCall(contact: Contact) {
  if (!contact.callable || callStatus.value === 'sending') return

  callingContact.value = contact
  callStatus.value = 'sending'
  callMessage.value = t('call.sending_request', { name: contact.displayName })

  try {
    const result = await (window as any).config.requestCall(contact.userName)
    if (result.ok) {
      callStatus.value = 'sent'
      callMessage.value = t('call.sent_success', { name: contact.displayName })
      setTimeout(() => {
        callStatus.value = 'idle'
        callingContact.value = null
      }, 4000)
    } else {
      callStatus.value = 'error'
      callMessage.value = t('call.contact_error', { code: result.code, detail: result.detail })
      setTimeout(() => {
        callStatus.value = 'idle'
        callingContact.value = null
      }, 5000)
    }
  } catch (e) {
    callStatus.value = 'error'
    callMessage.value = t('call.connection_error')
    setTimeout(() => {
      callStatus.value = 'idle'
      callingContact.value = null
    }, 4000)
  }
}

function dismissStatus() {
  callStatus.value = 'idle'
  callingContact.value = null
}

function triggerVoiceAssistant() {
  window.dispatchEvent(new CustomEvent('start-voice-assistant'))
}

const isDown = ref(false)
const startX = ref(0)
const scrollLeftVal = ref(0)

function handleMouseDown(e: MouseEvent) {
  const container = e.currentTarget as HTMLElement
  if (!container) return
  isDown.value = true
  container.classList.add('active-dragging')
  startX.value = e.pageX - container.offsetLeft
  scrollLeftVal.value = container.scrollLeft
}

function handleMouseLeave() {
  isDown.value = false
  const container = document.querySelector('.contacts-view.horizontal-scroll') as HTMLElement
  if (container) {
    container.classList.remove('active-dragging')
  }
}

function handleMouseUp() {
  isDown.value = false
  const container = document.querySelector('.contacts-view.horizontal-scroll') as HTMLElement
  if (container) {
    container.classList.remove('active-dragging')
  }
}

function handleMouseMove(e: MouseEvent) {
  if (!isDown.value) return
  e.preventDefault()
  const container = e.currentTarget as HTMLElement
  if (!container) return
  const x = e.pageX - container.offsetLeft
  const walk = (x - startX.value) * 1.5
  container.scrollLeft = scrollLeftVal.value - walk
}

function handleWheel(e: WheelEvent) {
  const container = e.currentTarget as HTMLElement
  if (container) {
    container.scrollLeft += e.deltaY + e.deltaX
  }
}
</script>

<template>
  <div class="view-container">
    <!-- Header -->
    <div class="header glass-panel">
      <div class="header-left">
        <h1 class="header-title">{{ t('call.title') }}</h1>
      </div>

      <div class="header-center">
        <div class="clock-wrap">
          <div class="date-str">{{ formattedDate }}</div>
          <div class="time-str">{{ formattedTime }}</div>
        </div>
      </div>

      <div class="header-actions">
        <button class="square-action-btn" @click="triggerVoiceAssistant">
          <img src="/svg/voice.svg" :alt="t('call.voice')" />
        </button>
        <div class="actions-spacer"></div>
        <button class="square-action-btn" @click="router.push('/')">
          <img src="/images/back.png" :alt="t('call.back')" />
        </button>
      </div>
    </div>

    <!-- Contact cards scrollable row -->
    <div 
      class="contacts-view horizontal-scroll" 
      @wheel="handleWheel"
      @mousedown="handleMouseDown"
      @mouseleave="handleMouseLeave"
      @mouseup="handleMouseUp"
      @mousemove="handleMouseMove"
    >
      <div class="contacts-horizontal-row" v-if="contacts.length > 0">
        <div
          v-for="(contact, index) in contacts"
          :key="contact.userName || contact.displayName"
          class="contact-card shadow-lg"
          :class="{ disabled: !contact.callable, calling: callingContact?.displayName === contact.displayName }"
          @click="requestCall(contact)"
        >
          <div class="contact-card-top">
            <img
              :src="getImageUrl(contact, index)"
              :alt="contact.displayName"
              class="contact-img"
              @error="(e: any) => (e.target.src = '/images/landscape_1.png')"
            />
          </div>
          <div class="contact-card-bottom">
            <div class="contact-name">{{ contact.displayName }}</div>
            <div v-if="!contact.callable" class="contact-unavail">{{ t('call.offline') }}</div>
          </div>
        </div>
      </div>

      <div v-else class="no-contacts">
        <p>{{ t('call.no_contacts') }}</p>
        <p class="no-contacts-hint">{{ t('call.add_contacts_hint', { path: contactsPath }) }}</p>
      </div>
    </div>

    <!-- Missed Calls Section -->
    <div class="missed-calls-container">
      <div v-if="latestMissedCall" class="missed-calls-panel glass-panel shadow-lg">
        <div class="missed-title">{{ t('call.missed_calls') }}</div>
        <div class="missed-list">
          <div class="missed-item">
            <div class="missed-info">
              <span class="missed-author">{{ latestMissedCall.author }}</span>
              <span class="missed-time">{{ latestMissedCall.time }}</span>
            </div>
            <button class="callback-btn" @click="requestCall({ displayName: latestMissedCall.author, userName: latestMissedCall.userName, callable: true } as any)">
              {{ t('call.request_call') }}
            </button>
            <button class="close-btn" @click="removeMissedCall(latestMissedCall.id)">
              ✖
            </button>
          </div>
        </div>
      </div>
      <div v-else class="no-missed-calls">
        {{ t('call.no_missed_calls') }}
      </div>
    </div>

    <!-- Call status modal -->
    <Teleport to="body">
      <div v-if="callStatus !== 'idle'" class="call-modal-overlay">
        <div class="call-modal-card" :class="callStatus">
          <div class="call-modal-icon">
            <span v-if="callStatus === 'sending'" class="call-spinner" />
            <span v-else-if="callStatus === 'sent'">✅</span>
            <span v-else>❌</span>
          </div>
          <div class="call-modal-title">
            {{ callStatus === 'sending' ? t('call.connecting') : callStatus === 'sent' ? t('call.request_sent') : t('call.error') }}
          </div>
          <div class="call-modal-msg">{{ callMessage }}</div>
          <button v-if="callStatus !== 'sending'" class="call-dismiss-btn" @click="dismissStatus">
            {{ t('call.close') }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.view-container {
  height: 100vh;
  padding: 2.5rem 0 1.5rem; /* Removed side padding for full-bleed */
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  overflow: hidden;
}


.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.2rem 3rem; /* Kept header padding */
  border-radius: 20px;
  margin: 0 3rem; /* Align header with standard margins */
}




.header-left {
  flex: 1;
}

.header-title {
  font-size: 2.8rem;
  font-weight: 800;
  margin: 0;
  color: #111;
}

.header-center {
  flex: 1;
  text-align: center;
}

.clock-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.date-str {
  font-size: 1.82rem; /* +30% from 1.4 */
  font-weight: 700;
  color: #333;
}

.time-str {
  font-size: 1.56rem; /* +30% from 1.2 */
  font-weight: 600;
  color: #666;
}

.header-actions {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  gap: 1.5rem;
  align-items: center;
}

.actions-spacer {
  width: 2rem;
}

.square-action-btn {
  width: 5rem;
  height: 5rem;
  border-radius: 12px;
  background: white;
  border: 2px solid #000;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.square-action-btn img {
  width: 3rem;
  height: 3rem;
}

/* Horizontal Scroll area */
.contacts-view.horizontal-scroll {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  display: flex;
  align-items: center;
  padding: 1rem 0;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  user-select: none;
  /* Immersive fading edges */
  mask-image: linear-gradient(to right, 
    transparent 0%, 
    black 10%, 
    black 90%, 
    transparent 100%
  );
  -webkit-mask-image: linear-gradient(to right, 
    transparent 0%, 
    black 10%, 
    black 90%, 
    transparent 100%
  );
}

.contacts-view.horizontal-scroll.active-dragging {
  scroll-snap-type: none !important;
  scroll-behavior: auto !important;
  cursor: grabbing;
}

/* Hide scrollbar */
.contacts-view.horizontal-scroll::-webkit-scrollbar {
  display: none;
}

.contacts-horizontal-row {
  display: flex;
  gap: 3rem;
  padding: 0 12%; /* Side padding to ensure first/last cards can center */
  height: 100%;
  align-items: center;
}

/* Contact card */
.contact-card {
  flex-shrink: 0;
  width: 30vw; /* Fits 3 per view more precisely */
  max-width: 480px;
  background: white;
  border-radius: 32px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  aspect-ratio: 0.82;
  border: 2px solid transparent;
  scroll-snap-align: center;
}



.contact-card:hover:not(.disabled) {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0,0,0,0.15);
}

.contact-card-top {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #f0f0f0;
}

.contact-img {
  width: 100%;
  height: 100%;
  object-fit: cover; /* Full bleed */
  transition: transform 0.5s;
}

.contact-card:hover .contact-img {
  transform: scale(1.05);
}

.contact-card-bottom {
  height: 9rem;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.contact-name {
  font-size: 2.4rem;
  font-weight: 700;
  color: #111;
  text-align: center;
}

.contact-unavail {
  font-size: 1.2rem;
  color: #999;
  font-weight: 600;
  margin-top: 0.3rem;
}

.contact-card.disabled {
  opacity: 0.5;
  filter: grayscale(1);
  cursor: not-allowed;
}

.contact-card.calling {
  border-color: #1E90FF;
  animation: cardPulse 1.5s ease-in-out infinite;
}

@keyframes cardPulse {
  0% { box-shadow: 0 0 0 0 rgba(30,144,255,0.4); }
  70% { box-shadow: 0 0 0 15px rgba(30,144,255,0); }
  100% { box-shadow: 0 0 0 0 rgba(30,144,255,0); }
}


/* No contacts */
.no-contacts {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
  color: var(--text-secondary);
  font-size: 1.4rem;
  text-align: center;
}

.no-contacts-hint {
  font-size: 1rem;
  opacity: 0.6;
}

/* Call status modal */
.call-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.call-modal-card {
  background: white;
  border-radius: 28px;
  padding: 3rem 4rem;
  width: min(550px, 90vw);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  box-shadow: 0 30px 80px rgba(0,0,0,0.35);
  animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes popIn {
  from { transform: scale(0.85); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.call-modal-icon {
  font-size: 4rem;
}

.call-spinner {
  display: block;
  width: 4rem;
  height: 4rem;
  border: 5px solid #eee;
  border-top-color: #1E90FF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.call-modal-title {
  font-size: 2rem;
  font-weight: 800;
  color: #111;
}

.call-modal-msg {
  font-size: 1.3rem;
  color: #555;
  text-align: center;
}

.call-dismiss-btn {
  background: #1E90FF;
  color: white;
  border: none;
  border-radius: 14px;
  padding: 0.8rem 2.5rem;
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 0.5rem;
}

/* Missed Calls */
.missed-calls-container {
  height: 10rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: auto;
}

.missed-calls-panel {
  background: white;
  padding: 1.5rem 2.5rem;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 2rem;
  border: 3px solid #ff4d4d;
  animation: slideUp 0.5s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(40px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.missed-title {
  font-size: 1.6rem;
  font-weight: 800;
  color: #ff4d4d;
  text-transform: uppercase;
}

.missed-list {
  display: flex;
  gap: 1.5rem;
}

.missed-item {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-left: 1.5rem;
  border-left: 3px solid rgba(0,0,0,0.1);
}

.missed-info {
  display: flex;
  flex-direction: column;
}

.missed-author {
  font-size: 1.5rem;
  font-weight: 700;
  color: #000;
}

.missed-time {
  font-size: 1.1rem;
  font-weight: 500;
  color: #666;
}

.callback-btn {
  background: #4CAF50; /* Green */
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1.1rem;
  cursor: pointer;
  transition: transform 0.2s;
  box-shadow: 0 4px 10px rgba(76, 175, 80, 0.3);
}

.callback-btn:active { transform: scale(0.95); }

.close-btn {
  background: transparent;
  color: #aaa;
  border: 2px solid rgba(0,0,0,0.1);
  padding: 0.7rem 1rem;
  border-radius: 12px;
  font-weight: 900;
  font-size: 1.1rem;
  cursor: pointer;
  margin-left: 0.5rem;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #ff4d4d;
  color: white;
  border-color: #ff4d4d;
}

.no-missed-calls {
  font-size: 1.8rem;
  font-weight: 700;
  color: rgba(0,0,0,0.2);
}

</style>
