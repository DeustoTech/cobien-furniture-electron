<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t, locale } = useI18n()

const messages = ref<any[]>([])
const currentIndex = ref(0)
const loading = ref(true)
const showReplyModal = ref(false)
const showFullscreenImage = ref(false)

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
  return currentTime.value.toLocaleDateString(locale.value, { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  })
})

const formattedTime = computed(() => {
  return currentTime.value.toLocaleTimeString(locale.value, { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
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
  if (confirm(t('board.delete_confirm'))) {

    const ok = await (window as any).config.deleteBoardMessage(currentMessage.value.id)
    if (ok) {
      messages.value.splice(currentIndex.value, 1)
      if (currentIndex.value >= messages.value.length) {
        currentIndex.value = Math.max(0, messages.value.length - 1)
      }
    }
  }
}

async function speak(text: string) {
  try {
    const buffer = await (window as any).config.ttsSpeak(text)
    if (buffer) {
      const audioCtx = new AudioContext()
      await audioCtx.resume()
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      const decoded = await audioCtx.decodeAudioData(arrayBuffer)
      const source = audioCtx.createBufferSource()
      source.buffer = decoded
      source.connect(audioCtx.destination)
      await new Promise<void>(resolve => {
        source.onended = () => resolve()
        source.start()
      })
    }
  } catch(e) {
    console.error('TTS Error:', e)
  }
}

async function readCurrentMessage() {
  if (!currentMessage.value) return
  
  const msg = currentMessage.value
  // Piper respects punctuation. Slight pauses added via punctuation.
  const intro = t('board.narration_intro', { author: msg.author, date: msg.created_at_human })
  const body = msg.text.replace(/\./g, '. ... ').replace(/,/g, ', ... ')
  
  await speak(intro + body)
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
        <h1 class="header-title">{{ t('board.title') }}</h1>

      </div>

      <div class="header-center">
        <div class="date-time-wrap">
          <div class="date-str">{{ formattedDate }}</div>
          <div class="time-str">{{ formattedTime }}</div>
        </div>
      </div>

      <div class="header-actions">
        <button class="audio-btn" @click="readCurrentMessage" v-if="messages.length > 0">
          <img src="/images/play.png" :alt="t('board.read')" />
        </button>
        <button class="voice-button-small" @click="triggerVoiceAssistant">
          <img src="/images/voice.png" :alt="t('board.voice')" />
        </button>
        <button class="back-btn" @click="goBack" style="margin-left: 2rem;">
          <img src="/images/back.png" :alt="t('board.back')" />
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
        <p>{{ t('common.loading') }}</p>
      </div>

      <div v-else-if="messages.length === 0" class="main-card empty glass-panel">
        <p>{{ t('board.empty') }}</p>
      </div>


      <div v-else class="main-card message-card shadow-lg">
        <div class="card-layout">
          <!-- Left Content -->
          <div class="content-side">
            <div class="message-sender">
              <img v-if="currentMessage.author_avatar" :src="currentMessage.author_avatar" class="author-avatar" />
              <div v-else class="avatar-fallback">{{ currentMessage.author.charAt(0) }}</div>
              
              <div class="sender-meta">
                <div class="author-name">{{ t('board.from', { author: currentMessage.author }) }}</div>
                <div class="post-date">{{ currentMessage.created_at_human }}</div>
              </div>

            </div>

            <div class="message-body">
              <p class="message-text">{{ currentMessage.text }}</p>
            </div>

            <div class="message-actions">
              <button 
                v-if="currentMessage.quick_replies && currentMessage.quick_replies.length > 0 && !currentMessage.quick_reply_selected"
                class="reply-trigger-btn"
                @click="showReplyModal = true"
              >
                {{ t('board.respond_btn') }}
              </button>
              <div v-else-if="currentMessage.quick_reply_selected" class="replied-status">
                <strong>{{ t('board.responded_label') }}</strong> {{ typeof currentMessage.quick_reply_selected === 'object' ? currentMessage.quick_reply_selected.text : currentMessage.quick_reply_selected }}
              </div>
            </div>
          </div>

          <!-- Right Image -->
          <div class="image-side" v-if="currentMessage.image" @click="showFullscreenImage = true">
            <img :src="currentMessage.image" class="full-img" />
          </div>
          <div class="image-side no-img" v-else>
            <div class="no-img-placeholder">{{ t('board.no_image') }}</div>
          </div>

        </div>
      </div>

      <button class="side-nav-btn next" @click="nextMessage" :disabled="currentIndex === messages.length - 1">
        <span class="arrow">›</span>
      </button>
    </div>

    <!-- Global Trash Button -->
    <button class="global-delete-btn" @click="handleDelete" v-if="messages.length > 0">
      <img src="/images/trash.png" :alt="t('board.delete_btn')" />
    </button>

    <!-- Reply Modal -->
    <Teleport to="body">
      <div v-if="showReplyModal && currentMessage" class="modal-overlay" @click.self="showReplyModal = false">
        <div class="reply-modal glass-panel">
          <div class="modal-header">
            <h2>{{ t('board.respond_to', { author: currentMessage.author }) }}</h2>
            <button class="close-modal" @click="showReplyModal = false">✕</button>
          </div>

          
          <div class="replies-list">
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

        </div>
      </div>
    </Teleport>
    
    <!-- Fullscreen Image Modal -->
    <Teleport to="body">
      <div v-if="showFullscreenImage && currentMessage?.image" class="fullscreen-image-overlay" @click="showFullscreenImage = false">
        <button class="close-fullscreen-btn" @click="showFullscreenImage = false">✕</button>
        <img :src="currentMessage.image" class="fullscreen-img" />
      </div>
    </Teleport>
  </div>

</template>

<style scoped>
.view-container {
  height: 100vh;
  padding: 4rem 3rem 2.5rem;

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
  font-size: 2.8rem;
  font-weight: 800;
  color: #111;
  text-transform: capitalize;
}

.time-str {
  font-size: 2.2rem;
  font-weight: 700;
  color: #444;
}

.header-actions {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.actions-spacer {
  width: 2rem;
}


.back-btn, .voice-button-small, .audio-btn {
  width: 5.5rem;
  height: 5.5rem;

  background: white;
  border: 2px solid #000;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.back-btn img, .voice-button-small img, .audio-btn img {
  width: 3.5rem;
  height: 3.5rem;
}

.audio-btn {
  background: #f0f0f0;
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
  width: 78px;
  height: 78px;
  border-radius: 14px;
  object-fit: cover;
  border: 3px solid white;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.avatar-fallback {
  width: 78px;
  height: 78px;
  border-radius: 14px;
  background: #2196F3;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  font-weight: 800;
}

.author-name {
  font-size: 2.2rem;
  font-weight: 800;
  color: #111;
}

.post-date {
  font-size: 1.3rem;
  font-weight: 600;
  color: #888;
}

.message-body {
  flex: 1;
  overflow-y: auto;
  padding-right: 1rem;
}

.message-text {
  font-size: 2.1rem;
  line-height: 1.5;
  color: #111;
  white-space: pre-wrap;
}

.message-actions {
  margin-top: 2rem;
}

.reply-trigger-btn {
  width: 100%;
  padding: 1.6rem;
  background: white;
  color: black;
  border: 2px solid #000;
  border-radius: 14px;
  font-size: 1.6rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.reply-trigger-btn:active { transform: scale(0.97); }

.replied-status {
  padding: 1.5rem;
  background: rgba(0,0,0,0.03);
  border-radius: 14px;
  font-size: 1.92rem;
  color: #444;
  border: 1px dashed #ccc;
}

.replied-status strong {
  color: #000;
}

/* Right Image Side */
.image-side {
  flex: 1;
  background: #fcfcfc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  cursor: zoom-in;
}


.full-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 1rem;
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

.replies-list {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.reply-option {
  width: 100%;
  padding: 1.8rem;
  background: #f8f9fa;
  border: 2px solid #eee;
  border-radius: 18px;
  font-size: 1.6rem;
  font-weight: 700;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.reply-option:hover {
  background: white;
  border-color: #000;
  transform: scale(1.02);
}

.reply-option.selected {
  background: #000;
  border-color: #000;
  color: white;
}

.selection-status {
  text-align: center;
  font-size: 1.3rem;
  color: #666;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

/* Fullscreen Image */
.fullscreen-image-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  cursor: zoom-out;
}

.fullscreen-img {
  max-width: 98%;
  max-height: 98%;
  object-fit: contain;
  box-shadow: 0 0 80px rgba(0,0,0,0.8);
  animation: imgZoom 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes imgZoom {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.close-fullscreen-btn {
  position: absolute;
  top: 2rem;
  right: 2rem;
  width: 7rem;
  height: 7rem;
  border-radius: 50%;
  background: white;
  border: 3px solid #000;
  color: black;
  font-size: 3.5rem;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 8px 25px rgba(0,0,0,0.5);
  z-index: 3001;
  transition: transform 0.2s;
}

.close-fullscreen-btn:active { transform: scale(0.9); }

</style>
