<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

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

onMounted(async () => {
  try {
    contacts.value = await (window as any).config.getContacts()
  } catch (e) {
    console.error('[CONTACTS] Error loading:', e)
  }
})

function getImageUrl(imagePath: string): string {
  if (!imagePath) return ''
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
      <button class="icon-btn" @click="router.push('/')">
        <img src="/images/back.png" alt="Volver" class="hdr-icon" />
      </button>
      <h1 class="header-title">Contactos</h1>
      <button class="icon-btn" @click="triggerVoiceAssistant">
        <img src="/images/voice.png" alt="Voz" class="hdr-icon" />
      </button>
    </div>

    <!-- Contact cards scrollable row -->
    <div class="contacts-scroll-area">
      <div class="contacts-row" v-if="contacts.length > 0">
        <div
          v-for="contact in contacts"
          :key="contact.userName || contact.displayName"
          class="contact-card"
          :class="{ disabled: !contact.callable, calling: callingContact?.displayName === contact.displayName }"
          @click="requestCall(contact)"
        >
          <div class="contact-img-wrap">
            <img
              v-if="contact.imagePath"
              :src="getImageUrl(contact.imagePath)"
              :alt="contact.displayName"
              class="contact-img"
              @error="(e: any) => (e.target.style.display = 'none')"
            />
            <div v-else class="contact-avatar-placeholder">
              {{ contact.displayName.charAt(0).toUpperCase() }}
            </div>
          </div>
          <div class="contact-name">{{ contact.displayName }}</div>
          <div v-if="!contact.callable" class="contact-unavail">No disponible</div>
          <div v-else class="contact-call-icon">📞</div>
        </div>
      </div>

      <div v-else class="no-contacts">
        <p>No hay contactos configurados.</p>
        <p class="no-contacts-hint">Añade contactos en <code>cobien_FrontEnd/app/contacts/list_contacts.txt</code></p>
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

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-radius: 20px;
}

.header-title {
  font-size: 3rem;
  font-weight: 800;
  color: var(--text-primary);
}

.icon-btn {
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 14px;
  background: rgba(255,255,255,0.85);
  border: 1.5px solid rgba(0,0,0,0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transition: transform 0.15s;
}

.icon-btn:active { transform: scale(0.92); }

.hdr-icon {
  width: 2.5rem;
  height: 2.5rem;
  object-fit: contain;
}

/* Scroll area */
.contacts-scroll-area {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
}

.contacts-row {
  display: flex;
  gap: 2rem;
  padding: 1.5rem 0.5rem;
  height: 100%;
  align-items: center;
}

/* Contact card */
.contact-card {
  flex-shrink: 0;
  width: 20rem;
  background: rgba(255,255,255,0.88);
  border-radius: 24px;
  padding: 2.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  cursor: pointer;
  box-shadow: 0 8px 28px rgba(0,0,0,0.1);
  transition: transform 0.2s, box-shadow 0.2s;
  backdrop-filter: blur(10px);
  border: 2px solid transparent;
  height: calc(100% - 2rem);
  justify-content: center;
}

.contact-card:hover:not(.disabled) {
  transform: translateY(-6px) scale(1.02);
  box-shadow: 0 16px 40px rgba(30,144,255,0.25);
  border-color: rgba(30,144,255,0.4);
}

.contact-card:active:not(.disabled) {
  transform: scale(0.97);
}

.contact-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.contact-card.calling {
  border-color: #1E90FF;
  box-shadow: 0 0 0 4px rgba(30,144,255,0.3);
  animation: callPulse 1s ease-in-out infinite;
}

@keyframes callPulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(30,144,255,0.3); }
  50% { box-shadow: 0 0 0 10px rgba(30,144,255,0.1); }
}

.contact-img-wrap {
  width: 12rem;
  height: 12rem;
  border-radius: 50%;
  overflow: hidden;
  background: #eee;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}

.contact-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.contact-avatar-placeholder {
  font-size: 5rem;
  font-weight: 700;
  color: #1E90FF;
}

.contact-name {
  font-size: 1.8rem;
  font-weight: 700;
  color: #111;
  text-align: center;
}

.contact-call-icon {
  font-size: 2.5rem;
}

.contact-unavail {
  font-size: 1.1rem;
  color: #999;
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
</style>
