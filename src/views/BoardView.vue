<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const messages = ref<any[]>([])
const currentIndex = ref(0)
const loading = ref(true)

const currentMessage = computed(() => {
  if (messages.value.length === 0) return null
  return messages.value[currentIndex.value]
})

onMounted(async () => {
  await loadMessages()
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
  const deviceId = 'CoBien6' // Fallback, could be fetched
  if (!msg.read_by.includes(deviceId)) {
    const ok = await (window as any).config.markMessageRead(msg.id)
    if (ok) {
      msg.read_by.push(deviceId)
    }
  }
}

function nextMessage() {
  if (currentIndex.value > 0) {
    currentIndex.value--
    checkAndMarkRead(messages.value[currentIndex.value])
  }
}

function prevMessage() {
  if (currentIndex.value < messages.value.length - 1) {
    currentIndex.value++
    checkAndMarkRead(messages.value[currentIndex.value])
  }
}

async function reply(text: string) {
  if (!currentMessage.value) return
  const ok = await (window as any).config.submitQuickReply(currentMessage.value.id, text)
  if (ok) {
    currentMessage.value.quick_reply_selected = text
  }
}

async function deleteMsg() {
  if (!currentMessage.value) return
  const ok = await (window as any).config.deleteBoardMessage(currentMessage.value.id)
  if (ok) {
    messages.value.splice(currentIndex.value, 1)
    if (currentIndex.value >= messages.value.length) {
      currentIndex.value = Math.max(0, messages.value.length - 1)
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
      <div class="title">Mensajes</div>
      <button class="voice-button" @click="triggerVoiceAssistant">
        <img src="/images/voice.png" alt="Voice" class="icon" />
      </button>
    </div>

    <div v-if="loading" class="loading-state glass-panel">
      Cargando mensajes...
    </div>
    
    <div v-else-if="messages.length === 0" class="empty-state glass-panel">
      No tienes ningún mensaje nuevo.
    </div>

    <div v-else class="board-card glass-panel">
      <!-- Navigation Left -->
      <button class="nav-btn left" @click="prevMessage" :disabled="currentIndex === messages.length - 1">
        ◀
      </button>

      <div class="message-content">
        <div class="message-header">
          <div class="author-info">
            <img v-if="currentMessage.author_avatar" :src="currentMessage.author_avatar" class="avatar" />
            <div v-else class="avatar-placeholder">{{ currentMessage.author.charAt(0) }}</div>
            <div>
              <div class="author-name">{{ currentMessage.author }}</div>
              <div class="message-time">{{ currentMessage.created_at_human }}</div>
            </div>
          </div>
          <button class="delete-btn" @click="deleteMsg"><img src="/images/trash.png" alt="Borrar" class="btn-icon-small" /></button>
        </div>

        <div class="message-body">
          <p class="message-text" v-if="currentMessage.text">{{ currentMessage.text }}</p>
          <div class="image-container" v-if="currentMessage.image">
            <img :src="currentMessage.image" class="message-image" />
          </div>
        </div>

        <div class="message-footer" v-if="currentMessage.quick_replies && currentMessage.quick_replies.length > 0">
          <div v-if="currentMessage.quick_reply_selected" class="reply-answered">
            Respondiste: <strong>{{ currentMessage.quick_reply_selected }}</strong>
          </div>
          <div v-else class="quick-replies">
            <button 
              v-for="rep in currentMessage.quick_replies" 
              :key="rep" 
              class="reply-btn"
              @click="reply(rep)"
            >
              {{ rep }}
            </button>
          </div>
        </div>
      </div>

      <!-- Navigation Right -->
      <button class="nav-btn right" @click="nextMessage" :disabled="currentIndex === 0">
        ▶
      </button>

      <div class="pagination">
        {{ messages.length - currentIndex }} de {{ messages.length }}
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

.loading-state, .empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--text-secondary);
  border-radius: 20px;
}

.board-card {
  flex: 1;
  border-radius: 20px;
  position: relative;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 2rem 5rem;
  overflow: hidden;
}

.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 4rem;
  height: 4rem;
  font-size: 2rem;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.1);
  background: white;
  box-shadow: var(--shadow-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: all 0.2s;
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-btn:not(:disabled):hover {
  transform: translateY(-50%) scale(1.1);
}

.nav-btn.left { left: 1rem; }
.nav-btn.right { right: 1rem; }

.message-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 15px;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  max-width: 900px;
  width: 100%;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

.author-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.avatar, .avatar-placeholder {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-placeholder {
  background: var(--accent-blue);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
}

.author-name {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text-primary);
}

.message-time {
  font-size: 1.1rem;
  color: var(--text-secondary);
}

.delete-btn {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.delete-btn:hover {
  color: var(--accent-red);
}

.btn-icon-small {
  width: 2.2rem;
  height: 2.2rem;
  object-fit: contain;
}

.message-body {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.message-text {
  font-size: 1.8rem;
  line-height: 1.5;
  color: var(--text-primary);
  margin: 0;
}

.image-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  border-radius: 10px;
  overflow: hidden;
  min-height: 300px;
}

.message-image {
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
}

.message-footer {
  padding: 1.5rem 2rem;
  background: #f8f9fa;
  border-top: 1px solid rgba(0,0,0,0.05);
}

.reply-answered {
  font-size: 1.3rem;
  color: var(--text-secondary);
  text-align: center;
}

.reply-answered strong {
  color: var(--accent-green);
}

.quick-replies {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.reply-btn {
  padding: 0.8rem 2rem;
  font-size: 1.2rem;
  font-weight: 600;
  border: 2px solid var(--accent-blue);
  background: white;
  color: var(--accent-blue);
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.2s;
}

.reply-btn:hover {
  background: var(--accent-blue);
  color: white;
}

.pagination {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-secondary);
}
</style>
