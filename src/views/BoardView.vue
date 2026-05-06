<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'


const router = useRouter()
const messages = ref<any[]>([])
const currentIndex = ref(0)
const loading = ref(true)
const showReplyModal = ref(false)

const currentMessage = computed(() => {
  if (messages.value.length === 0) return null
  return messages.value[currentIndex.value]
})

// Clock for the header
const currentTime = ref(new Date())
let clockInterval: any = null

onMounted(async () => {
  await loadMessages()
  clockInterval = setInterval(() => {
    currentTime.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval)
})

const formattedDate = computed(() => {
  return currentTime.value.toLocaleDateString('es-ES', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  })
})

const formattedTime = computed(() => {
  return currentTime.value.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
})

async function loadMessages() {
  loading.value = true
  try {
    const data = await (window as any).config.getBoardMessages()
    messages.value = data
    if (messages.value.length > 0 && messages.value[currentIndex.value]) {
      checkAndMarkRead(messages.value[currentIndex.value])
    }
  } catch (e) {
    console.error('Error loading board:', e)
  } finally {
    loading.value = false
  }
}

async function checkAndMarkRead(msg: any) {
  const deviceId = 'CoBien6' 
  if (msg && !msg.read_by.includes(deviceId)) {
    const ok = await (window as any).config.markMessageRead(msg.id)
    if (ok) {
      msg.read_by.push(deviceId)
    }
  }
}

function nextMessage() {
  if (currentIndex.value < messages.value.length - 1) {
    currentIndex.value++
    checkAndMarkRead(messages.value[currentIndex.value])
  }
}

function prevMessage() {
  if (currentIndex.value > 0) {
    currentIndex.value--
    checkAndMarkRead(messages.value[currentIndex.value])
  }
}

async function handleReply(text: string) {
  if (!currentMessage.value) return
  const ok = await (window as any).config.submitQuickReply(currentMessage.value.id, text)
  if (ok) {
    currentMessage.value.quick_reply_selected = text
    showReplyModal.value = false
  }
}

async function handleDelete() {
  if (!currentMessage.value) return
  if (confirm('¿Seguro que quieres borrar este mensaje?')) {
    const ok = await (window as any).config.deleteBoardMessage(currentMessage.value.id)
    if (ok) {
      messages.value.splice(currentIndex.value, 1)
      if (currentIndex.value >= messages.value.length) {
        currentIndex.value = Math.max(0, messages.value.length - 1)
      }
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
    <!-- Header -->
    <div class="header glass-panel">
      <div class="header-left">
        <h1 class="header-title">Pizarra</h1>
      </div>

      <div class="header-center">
        <div class="date-time-wrap">
          <div class="date-str">{{ formattedDate }}</div>
          <div class="time-str">{{ formattedTime }}</div>
        </div>
      </div>

      <div class="header-actions">
        <button class="back-btn" @click="goBack">
          <img src="/images/back.png" alt="Volver" />
        </button>
        <button class="voice-button-small" @click="triggerVoiceAssistant">
          <img src="/images/voice.png" alt="Voz" />
        </button>
      </div>
    </div>

    <!-- Main Board Area -->
    <div class="board-wrapper">
      <button class="side-nav-btn prev" @click="prevMessage" :disabled="currentIndex === 0">
        <span class="arrow">‹</span>
      </button>

      <div v-if="loading" class="main-card loading glass-panel">
        <div class="spinner"></div>
        <p>Cargando mensajes...</p>
      </div>

      <div v-else-if="messages.length === 0" class="main-card empty glass-panel">
        <p>No hay mensajes en la pizarra</p>
      </div>

      <div v-else class="main-card message-card shadow-lg">
        <div class="card-layout">
          <!-- Left Content -->
          <div class="content-side">
            <div class="message-sender">
              <img v-if="currentMessage.author_avatar" :src="currentMessage.author_avatar" class="author-avatar" />
              <div v-else class="avatar-fallback">{{ currentMessage.author.charAt(0) }}</div>
              
              <div class="sender-meta">
                <div class="author-name">De {{ currentMessage.author }}:</div>
                <div class="post-date">{{ currentMessage.created_at_human }}</div>
              </div>
            </div>

            <div class="message-body">
              <p class="message-text">{{ currentMessage.text }}</p>
            </div>

            <div class="message-actions">
              <button 
                v-if="currentMessage.quick_replies && currentMessage.quick_replies.length > 0"
                class="reply-trigger-btn"
                @click="showReplyModal = true"
              >
                {{ currentMessage.quick_reply_selected ? 'Ver respuesta' : 'Contestar mensaje' }}
              </button>
            </div>
          </div>

          <!-- Right Image -->
          <div class="image-side" v-if="currentMessage.image">
            <img :src="currentMessage.image" class="full-img" />
          </div>
          <div class="image-side no-img" v-else>
            <div class="no-img-placeholder">Sin imagen</div>
          </div>
        </div>
      </div>

      <button class="side-nav-btn next" @click="nextMessage" :disabled="currentIndex === messages.length - 1">
        <span class="arrow">›</span>
      </button>
    </div>

    <!-- Global Trash Button -->
    <button class="global-delete-btn" @click="handleDelete" v-if="messages.length > 0">
      <img src="/images/trash.png" alt="Borrar" />
    </button>

    <!-- Reply Modal -->
    <Teleport to="body">
      <div v-if="showReplyModal && currentMessage" class="modal-overlay" @click.self="showReplyModal = false">
        <div class="reply-modal glass-panel">
          <div class="modal-header">
            <h2>Responder a {{ currentMessage.author }}</h2>
            <button class="close-modal" @click="showReplyModal = false">✕</button>
          </div>
          
          <div class="replies-grid">
            <button 
              v-for="rep in currentMessage.quick_replies" 
              :key="rep" 
              class="reply-option"
              :class="{ selected: currentMessage.quick_reply_selected === rep }"
              @click="handleReply(rep)"
            >
              {{ rep }}
            </button>
          </div>

          <div v-if="currentMessage.quick_reply_selected" class="selection-status">
            Has respondido: <strong>{{ currentMessage.quick_reply_selected }}</strong>
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
  gap: 1.5rem;
  position: relative;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2rem 2rem;
  border-radius: 20px;
}

.header-title {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0;
  color: #111;
}

.header-center {
  text-align: center;
}

.date-time-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.date-str {
  font-size: 1.4rem;
  font-weight: 700;
  color: #333;
  text-transform: capitalize;
}

.time-str {
  font-size: 1.1rem;
  font-weight: 600;
  color: #666;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.back-btn, .voice-button-small {
  width: 4rem;
  height: 4rem;
  background: white;
  border: 2px solid #000;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.back-btn img, .voice-button-small img {
  width: 2.5rem;
  height: 2.5rem;
}

/* Board Wrapper & Navigation */
.board-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0 1rem;
}

.side-nav-btn {
  width: 5rem;
  height: 5rem;
  background: white;
  border: 2px solid #000;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.side-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.arrow {
  font-size: 4rem;
  line-height: 1;
  color: #111;
  margin-top: -0.5rem;
}

/* Main Card */
.main-card {
  flex: 1;
  height: 100%;
  background: white;
  border-radius: 20px;
  overflow: hidden;
  display: flex;
}

.main-card.loading, .main-card.empty {
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 600;
  color: #888;
}

.card-layout {
  display: flex;
  width: 100%;
}

/* Left Content Side */
.content-side {
  width: 45%;
  padding: 2.5rem;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(0,0,0,0.05);
}

.message-sender {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  margin-bottom: 2rem;
}

.author-avatar {
  width: 65px;
  height: 65px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid white;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.avatar-fallback {
  width: 65px;
  height: 65px;
  border-radius: 50%;
  background: var(--accent-blue);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 800;
}

.author-name {
  font-size: 1.8rem;
  font-weight: 800;
  color: #111;
}

.post-date {
  font-size: 1.1rem;
  font-weight: 600;
  color: #888;
}

.message-body {
  flex: 1;
  overflow-y: auto;
  padding-right: 1rem;
}

.message-text {
  font-size: 1.7rem;
  line-height: 1.4;
  color: #333;
  white-space: pre-wrap;
}

.message-actions {
  margin-top: 2rem;
}

.reply-trigger-btn {
  width: 100%;
  padding: 1.2rem;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1.4rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 15px rgba(33, 150, 243, 0.3);
  transition: transform 0.2s;
}

.reply-trigger-btn:active { transform: scale(0.97); }

/* Right Image Side */
.image-side {
  flex: 1;
  background: #fcfcfc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.full-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-img-placeholder {
  font-size: 1.5rem;
  color: #ccc;
  font-weight: 600;
}

/* Global Delete Button */
.global-delete-btn {
  position: absolute;
  bottom: 2.5rem;
  right: 3rem;
  width: 4.5rem;
  height: 4.5rem;
  background: white;
  border: 2px solid #ff4d4d;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(255, 77, 77, 0.2);
  z-index: 50;
}

.global-delete-btn img {
  width: 2.8rem;
  height: 2.8rem;
}

/* Reply Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.reply-modal {
  width: 90%;
  max-width: 800px;
  background: white;
  border-radius: 28px;
  padding: 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  animation: modalScale 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes modalScale {
  from { transform: scale(0.9) translateY(20px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  font-size: 2.2rem;
  font-weight: 800;
  margin: 0;
}

.close-modal {
  background: #f0f0f0;
  border: none;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
}

.replies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.reply-option {
  padding: 1.5rem;
  background: #f8f9fa;
  border: 2px solid transparent;
  border-radius: 16px;
  font-size: 1.4rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.reply-option:hover {
  background: white;
  border-color: #2196F3;
  transform: translateY(-3px);
}

.reply-option.selected {
  background: #e3f2fd;
  border-color: #2196F3;
  color: #1976D2;
}

.selection-status {
  text-align: center;
  font-size: 1.3rem;
  color: #666;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

</style>
