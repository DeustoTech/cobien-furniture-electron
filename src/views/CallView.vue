<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

interface Contact {
  displayName: string
  userName: string
  imagePath: string
  callable: boolean
}

const contacts = ref<Contact[]>([])
const missedCalls = ref<any[]>([])
const callStatus = ref<'idle' | 'sending' | 'sent' | 'error'>('idle')
const callMessage = ref('')
const callingContact = ref<Contact | null>(null)

// Clock for the header
const currentTime = ref(new Date())
let clockTimer: any = null

onMounted(async () => {
  try {
    contacts.value = await (window as any).config.getContacts()
    // For demo, we can mock or fetch if the API exists
    // missedCalls.value = await (window as any).config.getMissedCalls()
    // Mocking one for the user to see
    missedCalls.value = [
      { id: 1, author: 'Carmen A. S.', time: '02:45', userName: 'carmen_as' }
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
  const str = currentTime.value.toLocaleDateString('es-ES', options)
  return str.charAt(0).toUpperCase() + str.slice(1)
})

const formattedTime = computed(() => {
  return currentTime.value.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
})

function getImageUrl(imagePath: string): string {
  if (!imagePath) return '/images/user_silhouette.png'
  return `cobien-media://${imagePath}`
}

async function requestCall(contact: Contact) {
  if (!contact.callable || callStatus.value === 'sending') return

  callingContact.value = contact
  callStatus.value = 'sending'
  callMessage.value = `Enviando solicitud a ${contact.displayName}...`

  try {
    const result = await (window as any).config.requestCall(contact.userName)
    if (result.ok) {
      callStatus.value = 'sent'
      callMessage.value = `✅ Solicitud enviada a ${contact.displayName}. Espera la llamada.`
      setTimeout(() => {
        callStatus.value = 'idle'
        callingContact.value = null
      }, 4000)
    } else {
      callStatus.value = 'error'
      callMessage.value = `❌ Error al contactar (${result.code}): ${result.detail}`
      setTimeout(() => {
        callStatus.value = 'idle'
        callingContact.value = null
      }, 5000)
    }
  } catch (e) {
    callStatus.value = 'error'
    callMessage.value = '❌ Error de conexión'
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
</script>

<template>
  <div class="view-container">
    <!-- Header -->
    <div class="header glass-panel">
      <div class="header-left">
        <h1 class="header-title">Contactos</h1>
      </div>

      <div class="header-center">
        <div class="clock-wrap">
          <div class="date-str">{{ formattedDate }}</div>
          <div class="time-str">{{ formattedTime }}</div>
        </div>
      </div>

      <div class="header-actions">
        <button class="square-action-btn" @click="triggerVoiceAssistant">
          <img src="/images/voice.png" alt="Voz" />
        </button>
        <div class="actions-spacer"></div>
        <button class="square-action-btn" @click="router.push('/')">
          <img src="/images/back.png" alt="Volver" />
        </button>
      </div>
    </div>

    <!-- Contact cards scrollable row -->
    <div class="contacts-view">
      <div class="contacts-grid" v-if="contacts.length > 0">
        <div
          v-for="contact in contacts"
          :key="contact.userName || contact.displayName"
          class="contact-card shadow-lg"
          :class="{ disabled: !contact.callable, calling: callingContact?.displayName === contact.displayName }"
          @click="requestCall(contact)"
        >
          <div class="contact-card-top">
            <img
              :src="getImageUrl(contact.imagePath)"
              :alt="contact.displayName"
              class="contact-img"
              @error="(e: any) => (e.target.src = '/images/user_silhouette.png')"
            />
          </div>
          <div class="contact-card-bottom">
            <div class="contact-name">{{ contact.displayName }}</div>
            <div v-if="!contact.callable" class="contact-unavail">Fuera de línea</div>
          </div>
        </div>
      </div>

      <div v-else class="no-contacts">
        <p>No hay contactos configurados.</p>
        <p class="no-contacts-hint">Añade contactos en <code>cobien_FrontEnd/app/contacts/list_contacts.txt</code></p>
      </div>
    </div>

    <!-- Missed Calls Section -->
    <div class="missed-calls-container">
      <div v-if="missedCalls.length > 0" class="missed-calls-panel glass-panel shadow-lg">
        <div class="missed-title">🚨 Llamadas Perdidas</div>
        <div class="missed-list">
          <div v-for="call in missedCalls" :key="call.id" class="missed-item">
            <div class="missed-info">
              <span class="missed-author">{{ call.author }}</span>
              <span class="missed-time">{{ call.time }}</span>
            </div>
            <button class="callback-btn" @click="requestCall({ displayName: call.author, userName: call.userName, callable: true } as any)">
              Solicitar llamada
            </button>
          </div>
        </div>
      </div>
      <div v-else class="no-missed-calls">
        No hay llamadas perdidas
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
            {{ callStatus === 'sending' ? 'Conectando...' : callStatus === 'sent' ? '¡Solicitud enviada!' : 'Error' }}
          </div>
          <div class="call-modal-msg">{{ callMessage }}</div>
          <button v-if="callStatus !== 'sending'" class="call-dismiss-btn" @click="dismissStatus">
            Cerrar
          </button>
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
  overflow: hidden;
}

.view-container {
  height: 100vh;
  padding: 2.5rem 3rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  overflow: hidden;
  background: transparent;
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

/* Grid area */
.contacts-view {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 2rem;
}

.contacts-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr); /* 3 per view as requested */
  gap: 3rem;
  padding: 0.5rem;
}

/* Contact card */
.contact-card {
  background: white;
  border-radius: 24px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  aspect-ratio: 0.85; /* Portrait orientation as in reference image */
  border: 2px solid transparent;
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
  object-fit: cover; /* A sangre */
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
}/* Missed Calls */
.missed-calls-container {
  height: 12rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: auto;
}

.missed-calls-panel {
  background: rgba(255, 255, 255, 0.9);
  padding: 1rem 3rem;
  border-radius: 24px;
  display: flex;
  align-items: center;
  gap: 2.5rem;
  border: 2px solid #ff4d4d;
  animation: slideUp 0.5s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.missed-title {
  font-size: 1.6rem;
  font-weight: 800;
  color: #ff4d4d;
}

.missed-list {
  display: flex;
  gap: 2rem;
}

.missed-item {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-left: 2rem;
  border-left: 2px solid rgba(0,0,0,0.1);
}

.missed-info {
  display: flex;
  flex-direction: column;
}

.missed-author {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111;
}

.missed-time {
  font-size: 1.1rem;
  color: #666;
}

.callback-btn {
  background: #000;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1.1rem;
  cursor: pointer;
  transition: transform 0.2s;
}

.callback-btn:active { transform: scale(0.95); }

.no-missed-calls {
  font-size: 1.4rem;
  font-weight: 600;
  color: rgba(0,0,0,0.3);
}

</style>
