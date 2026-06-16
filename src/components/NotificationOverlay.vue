<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMissedCalls } from '../composables/useMissedCalls'

const router = useRouter()
const { t } = useI18n()
const { addMissedCall } = useMissedCalls()

interface NotificationItem {
  id: string
  type: 'videocall' | 'new_message' | 'new_event' | 'missed_call'
  title?: string
  caller?: string
  sender?: string
  room?: string
  date?: string
  time?: string
  audio?: HTMLAudioElement | null
  autoDismissTimer?: ReturnType<typeof setTimeout> | null
}

const activeNotifications = ref<NotificationItem[]>([])
const localDeviceId = ref('CoBien6')
let isAudioMuted = false

onMounted(async () => {
  try {
    const sys = await (window as any).config.getSystemInfo()
    if (sys && sys.deviceId) {
      localDeviceId.value = sys.deviceId
    }
  } catch (e) {
    console.error('[NOTIF] Failed to get device info:', e)
  }

  // Register the backend sync notification listener
  ;(window as any).config.onNotification((notif: any) => {
    handleIncomingNotification(notif)
  })
})

onUnmounted(() => {
  // Stop all active audios and timers on destroy
  activeNotifications.value.forEach(item => {
    if (item.audio) item.audio.pause()
    if (item.autoDismissTimer) clearTimeout(item.autoDismissTimer)
  })
})

function formatTime(timestamp: string): string {
  try {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch (e) {
    return ''
  }
}

async function handleIncomingNotification(notif: any) {
  if (!notif || !notif.type) return

  const type = notif.type.toLowerCase()
  const sender = notif.from || notif.sender || ''
  
  // Ignore notifications from self
  const ignoredAccounts = [localDeviceId.value, 'cobien', 'CoBien']
  if (sender && ignoredAccounts.includes(sender)) {
    console.log(`[NOTIF] Ignored notification from self/portal: ${sender}`)
    return
  }

  // Avoid duplicates
  const isDuplicate = activeNotifications.value.some(item => {
    // If we receive a videocall but we already have a missed_call from the same sender (because we just rejected it), ignore it
    if (type === 'videocall' && item.type === 'missed_call' && item.caller === sender) return true
    
    if (item.type !== type) return false
    if (type === 'videocall' && item.caller === sender) return true
    if (type === 'new_message' && item.sender === sender) return true
    if (type === 'new_event' && item.title === notif.title) return true
    if (type === 'missed_call' && item.caller === sender) return true
    return false
  })

  if (isDuplicate) {
    console.log('[NOTIF] Ignored duplicate notification')
    return
  }

  console.log('[NOTIF] Processing incoming notification:', notif)

  let ringtoneFile = ''
  let item: NotificationItem = {
    id: `${Date.now()}-${Math.random()}`,
    type: type as any
  }

  // Load custom ringtones from user settings if set
  let settings: any = {}
  try {
    settings = await (window as any).config.getSettings()
  } catch (e) {}

  if (type === 'videocall') {
    item.caller = sender
    item.room = notif.room || localDeviceId.value
    ringtoneFile = settings?.notifications?.videollamada?.ringtone || 'ringtone6.wav'
  } else if (type === 'new_message') {
    item.sender = sender
    ringtoneFile = settings?.notifications?.nueva_foto?.ringtone || 'ringtone3.mp3'
  } else if (type === 'new_event') {
    item.title = notif.title || t('notification.new_event')
    item.date = notif.date || ''
    ringtoneFile = settings?.notifications?.nuevo_evento?.ringtone || 'ringtone2.mp3'
  } else if (type === 'events_reload') {
    // Backend signals that events were updated — show a subtle new_event notification if title provided
    console.log('[NOTIF] events_reload received — reloading event list')
    // Re-use new_event type for display so the user sees something
    item.type = 'new_event'
    item.title = notif.title || t('notification.new_event')
    item.date = notif.date || ''
    ringtoneFile = settings?.notifications?.nuevo_evento?.ringtone || 'ringtone2.mp3'
  } else if (type === 'missed_call') {
    item.caller = sender
    item.time = formatTime(notif.timestamp) || t('common.loading')
    ringtoneFile = '' // Typically missed calls don't play a continuous ringtone
    
    // Si llega un missed_call, cerramos la llamada entrante que esté sonando de ese mismo sender
    const activeCallIndex = activeNotifications.value.findIndex(n => n.type === 'videocall' && n.caller === sender)
    if (activeCallIndex !== -1) {
      console.log(`[NOTIF] Dismissing active videocall from ${sender} due to missed_call signal`)
      dismissNotification(activeNotifications.value[activeCallIndex].id)
    }
    
    // Register it globally for the Contacts view
    addMissedCall({ author: sender, userName: sender, time: item.time })
  } else {
    // Unknown notification type
    return
  }

  // Handle audio playback
  let audio: HTMLAudioElement | null = null
  if (ringtoneFile && ringtoneFile !== 'Ninguna' && ringtoneFile !== 'Aucune' && !isAudioMuted) {
    try {
      audio = new Audio(`/audio/ringtones/${ringtoneFile}`)
      if (type === 'videocall') {
        audio.loop = true
      }
      
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.then(() => {
          // If dismissed before play resolved, pause it immediately!
          const exists = activeNotifications.value.some(n => n.id === item.id)
          if (!exists && audio) {
            audio.pause()
            audio.removeAttribute('src')
            audio.load()
          }
        }).catch(err => console.warn('[NOTIF] Failed to play audio:', err))
      }
    } catch (err) {
      console.error('[NOTIF] Error creating audio element:', err)
    }
  }

  item.audio = audio

  // Auto-dismiss after 12s for non-call notifications
  if (item.type === 'new_message' || item.type === 'new_event') {
    item.autoDismissTimer = setTimeout(() => {
      dismissNotification(item.id)
    }, 12000)
  } else if (item.type === 'videocall') {
    // Auto-dismiss calls after 60s as a fallback in case network fails
    item.autoDismissTimer = setTimeout(() => {
      console.log(`[NOTIF] Auto-dismissing videocall from ${sender} due to 60s timeout`)
      dismissNotification(item.id)
    }, 60000)
  }

  activeNotifications.value.push(item)
}

function dismissNotification(id: string) {
  const index = activeNotifications.value.findIndex(item => item.id === id)
  if (index !== -1) {
    const item = activeNotifications.value[index]
    if (item.audio) {
      try { 
        item.audio.pause() 
        item.audio.removeAttribute('src')
        item.audio.load()
      } catch (e) {}
    }
    if (item.autoDismissTimer) {
      clearTimeout(item.autoDismissTimer)
    }
    activeNotifications.value.splice(index, 1)
  }
}

async function acceptCall(item: NotificationItem) {
  dismissNotification(item.id)
  if (item.caller) {
    try {
      await (window as any).config.openCall(item.room || item.caller)
    } catch (e) {
      console.error('[NOTIF] Failed to open call:', e)
    }
  }
}

function viewBoard(item: NotificationItem) {
  dismissNotification(item.id)
  router.push('/board')
}



function viewCalendar(item: NotificationItem) {
  dismissNotification(item.id)
  router.push('/events')
}

function declineCall(item: NotificationItem) {
  dismissNotification(item.id)
  
  const timeStr = formatTime(new Date().toISOString())
  // Register locally as missed call in overlay
  const missedItem: NotificationItem = {
    id: `missed-${Date.now()}`,
    type: 'missed_call',
    caller: item.caller,
    time: timeStr
  }
  
  activeNotifications.value.push(missedItem)
  
  // Register globally for the Contacts view
  addMissedCall({ author: item.caller || 'Desconocido', userName: item.caller || 'unknown', time: timeStr })
}
</script>

<template>
  <div class="notifications-container" v-if="activeNotifications.length > 0">
    <div 
      v-for="item in activeNotifications" 
      :key="item.id" 
      class="notification-card glass-panel shadow-lg"
    >
      <div class="card-icon-wrap">
        <span class="icon-pulse" v-if="item.type === 'videocall'">📞</span>
        <span class="icon-pulse" v-else-if="item.type === 'new_message'">💬</span>
        <span class="icon-pulse" v-else-if="item.type === 'new_event'">📅</span>
        <span class="icon-pulse" v-else>⚠️</span>
      </div>

      <div class="card-content">
        <!-- VIDEO CALL -->
        <template v-if="item.type === 'videocall'">
          <h2 class="title">{{ t('notification.incoming_call') }}</h2>
          <p class="desc">{{ t('notification.incoming_call_from', { caller: item.caller }) }}</p>
          <div class="actions">
            <button class="btn decline" @click="declineCall(item)">
              {{ t('notification.decline') }}
            </button>
            <button class="btn accept" @click="acceptCall(item)">
              {{ t('notification.accept') }}
            </button>
          </div>
        </template>

        <!-- BOARD MESSAGE -->
        <template v-else-if="item.type === 'new_message'">
          <h2 class="title">{{ t('notification.new_message') }}</h2>
          <p class="desc">{{ t('notification.new_message_from', { sender: item.sender }) }}</p>
          <div class="actions">
            <button class="btn decline" @click="dismissNotification(item.id)">
              {{ t('notification.later') }}
            </button>
            <button class="btn view" @click="viewBoard(item)">
              {{ t('notification.view') }}
            </button>
          </div>
        </template>

        <!-- CALENDAR EVENT -->
        <template v-else-if="item.type === 'new_event'">
          <h2 class="title">{{ t('notification.new_event') }}</h2>
          <p class="desc">{{ t('notification.new_event_title', { title: item.title }) }}</p>
          <div class="actions">
            <button class="btn decline" @click="dismissNotification(item.id)">
              {{ t('notification.ok') }}
            </button>
            <button class="btn view" @click="viewCalendar(item)">
              {{ t('notification.view_calendar') }}
            </button>
          </div>
        </template>

        <!-- MISSED CALL -->
        <template v-else-if="item.type === 'missed_call'">
          <h2 class="title">{{ t('notification.missed_call') }}</h2>
          <p class="desc">{{ t('notification.missed_call_from', { caller: item.caller, time: item.time }) }}</p>
          <div class="actions" style="justify-content: center;">
            <button class="btn decline" @click="dismissNotification(item.id)">
              {{ t('notification.close') }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notifications-container {
  position: fixed;
  top: 3rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20000;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: min(580px, 95vw);
  pointer-events: none;
}

.notification-card {
  background: white;
  border-radius: 28px;
  padding: 2rem 2.5rem;
  box-shadow: 0 25px 60px rgba(0,0,0,0.3);
  border: 1.5px solid rgba(0,0,0,0.1);
  display: flex;
  gap: 2rem;
  align-items: center;
  pointer-events: all;
  animation: slideDown 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes slideDown {
  from { transform: translateY(-40px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.card-icon-wrap {
  width: 5.5rem;
  height: 5.5rem;
  background: #f0f0f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  flex-shrink: 0;
}

.icon-pulse {
  animation: pulse 1.5s infinite;
  display: inline-block;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.title {
  font-size: 1.8rem;
  font-weight: 850;
  color: #111;
  margin: 0;
}

.desc {
  font-size: 1.3rem;
  font-weight: 600;
  color: #555;
  margin: 0;
}

.actions {
  display: flex;
  gap: 1.2rem;
  margin-top: 1rem;
}

.btn {
  flex: 1;
  height: 4.4rem;
  border-radius: 14px;
  font-size: 1.2rem;
  font-weight: 800;
  cursor: pointer;
  border: none;
  transition: transform 0.15s;
}

.btn:active {
  transform: scale(0.96);
}

.decline {
  background: #f0f0f0;
  color: #444;
}

.accept {
  background: #22c55e;
  color: white;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);
}

.view {
  background: #3b82f6;
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}
</style>
