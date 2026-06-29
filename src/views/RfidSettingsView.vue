<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ConfirmModal from '../components/ConfirmModal.vue'

const router = useRouter()
const { t } = useI18n()

// State
interface RFIDCard {
  id: number
  action: string
  extra: string
}
const cards = ref<RFIDCard[]>([])

// Dropdown options loaded from config/contacts
const weatherCities = ref<string[]>([])
const contacts = ref<any[]>([])

// Modal states
const isConfiguring = ref(false)
const configStep = ref(1) // 1: Waiting for card, 2: Selection form
const detectedCardId = ref<number | null>(null)
const selectedAction = ref('day_events')
const selectedExtra = ref('')

// Delete confirmation state
const showDeleteConfirm = ref(false)
const cardToDelete = ref<number | null>(null)

onMounted(async () => {
  await loadCards()
  await loadConfigData()

  // Subscribe to MQTT events for card detection
  if ((window as any).config && (window as any).config.onMqttEvent) {
    (window as any).config.onMqttEvent(handleMqttEvent)
  }
})

onUnmounted(async () => {
  if (isConfiguring.value) {
    await cancelConfigMode()
  }
})

async function loadCards() {
  try {
    const list = await (window as any).config.getRfidActions()
    const mapped: RFIDCard[] = []
    for (const [idStr, payload] of Object.entries(list)) {
      const id = parseInt(idStr)
      if (isNaN(id)) continue
      const p = payload as any
      mapped.push({
        id,
        action: p?.action || 'day_events',
        extra: p?.extra || ''
      })
    }
    cards.value = mapped
  } catch (e) {
    console.error('Failed to load RFID cards config:', e)
  }
}

async function loadConfigData() {
  try {
    const wConfig = await (window as any).config.getWeather()
    weatherCities.value = wConfig.active || []
  } catch (e) {}

  try {
    const cList = await (window as any).config.getContacts()
    contacts.value = cList || []
  } catch (e) {}
}

function handleMqttEvent(event: any) {
  if (event.topic === 'rfid/read' && isConfiguring.value && configStep.value === 1) {
    detectedCardId.value = event.cardId
    configStep.value = 2
    // Reset selected extra
    selectedExtra.value = ''
    selectedAction.value = 'day_events'
  }
}

async function startConfigMode() {
  detectedCardId.value = null
  configStep.value = 1
  isConfiguring.value = true
  try {
    await (window as any).config.initRfidConfigMode()
  } catch (e) {
    console.error('Failed to init RFID config mode:', e)
  }
}

async function cancelConfigMode() {
  isConfiguring.value = false
  configStep.value = 1
  detectedCardId.value = null
  try {
    await (window as any).config.cancelRfidConfigMode()
  } catch (e) {
    console.error('Failed to cancel RFID config mode:', e)
  }
}

async function saveCardAction() {
  if (detectedCardId.value === null) return

  // Resolve extra parameter default if empty
  let extra = selectedExtra.value
  if (selectedAction.value === 'weather' && !extra && weatherCities.value.length > 0) {
    extra = weatherCities.value[0]
  }
  if (selectedAction.value === 'videocall' && !extra && contacts.value.length > 0) {
    extra = contacts.value[0].name || contacts.value[0].userName
  }

  try {
    const success = await (window as any).config.saveRfidAction(
      detectedCardId.value,
      selectedAction.value,
      extra
    )
    if (success) {
      await loadCards()
      isConfiguring.value = false
    }
  } catch (e) {
    console.error('Failed to save RFID card action:', e)
  }
}

function deleteCard(id: number) {
  cardToDelete.value = id
  showDeleteConfirm.value = true
}

async function confirmDeleteCard() {
  if (cardToDelete.value === null) return
  try {
    const success = await (window as any).config.deleteRfidAction(cardToDelete.value)
    if (success) {
      await loadCards()
    }
  } catch (e) {
    console.error('Failed to delete RFID card action:', e)
  } finally {
    showDeleteConfirm.value = false
    cardToDelete.value = null
  }
}

function getActionName(action: string): string {
  if (action === 'day_events') return t('settings.rfid_settings.action_events')
  if (action === 'weather') return t('settings.rfid_settings.action_weather')
  if (action === 'videocall') return t('settings.rfid_settings.action_call')
  return action
}

function goBack() {
  router.push('/settings')
}
</script>

<template>
  <div class="view-container">
    <!-- Header -->
    <div class="header glass-panel">
      <div class="title">{{ t('settings.rfid_settings.title') }}</div>
      <div class="header-buttons">
        <button class="action-button primary" @click="startConfigMode">{{ t('settings.rfid_settings.start_btn') }}</button>
        <button class="icon-button" @click="goBack">
          <img src="/images/back.png" :alt="t('common.back')" class="icon" />
        </button>
      </div>
    </div>

    <!-- Instruction & List -->
    <div class="content-box glass-panel">
      <div class="instruction">{{ t('settings.rfid_settings.instruction') }}</div>

      <!-- Cards List -->
      <div class="cards-list">
        <div class="empty-state" v-if="cards.length === 0">
          No hay tarjetas configuradas.
        </div>
        <div class="card-item" v-for="card in cards" :key="card.id">
          <div class="card-info">
            <div class="card-id">{{ t('settings.rfid_settings.card_id') }}: {{ card.id }}</div>
            <div class="card-action">
              <span>{{ t('settings.rfid_settings.action') }}: <strong>{{ getActionName(card.action) }}</strong></span>
              <span v-if="card.action === 'weather' && card.extra" class="extra-info">
                ({{ t('settings.rfid_settings.city') }}: {{ card.extra }})
              </span>
              <span v-if="card.action === 'videocall' && card.extra" class="extra-info">
                ({{ t('settings.rfid_settings.contact') }}: {{ card.extra }})
              </span>
            </div>
          </div>
          <button class="delete-btn-card" @click="deleteCard(card.id)">
            {{ t('settings.rfid_settings.delete_btn') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Config Modal -->
    <div class="modal-overlay" v-if="isConfiguring">
      <div class="modal-content glass-panel">
        <div class="modal-title">{{ t('settings.rfid_settings.waiting_title') }}</div>

        <!-- Step 1: Waiting for scan -->
        <div v-if="configStep === 1" class="modal-step-center">
          <div class="spinner-container">
            <div class="pulsing-circle"></div>
            <img src="/images/card.png" class="scanning-card-icon" alt="card" />
          </div>
          <div class="waiting-text">{{ t('settings.rfid_settings.waiting_desc') }}</div>
        </div>

        <!-- Step 2: Form settings -->
        <div v-else class="modal-step-form">
          <div class="detected-id-badge">
            {{ t('settings.rfid_settings.card_id') }}: <strong>{{ detectedCardId }}</strong>
          </div>
          
          <div class="form-group">
            <label class="form-label">{{ t('settings.rfid_settings.select_action') }}</label>
            <select class="form-select" v-model="selectedAction">
              <option value="day_events">{{ t('settings.rfid_settings.action_events') }}</option>
              <option value="weather">{{ t('settings.rfid_settings.action_weather') }}</option>
              <option value="videocall">{{ t('settings.rfid_settings.action_call') }}</option>
            </select>
          </div>

          <!-- Weather parameter select -->
          <div class="form-group" v-if="selectedAction === 'weather'">
            <label class="form-label">{{ t('settings.rfid_settings.city') }}</label>
            <select class="form-select" v-model="selectedExtra">
              <option v-for="city in weatherCities" :key="city" :value="city">{{ city }}</option>
            </select>
            <div v-if="weatherCities.length === 0" class="no-options-warning">
              ⚠️ No hay ciudades activas en configuración del clima.
            </div>
          </div>

          <!-- Contacts parameter select -->
          <div class="form-group" v-if="selectedAction === 'videocall'">
            <label class="form-label">{{ t('settings.rfid_settings.contact') }}</label>
            <select class="form-select" v-model="selectedExtra">
              <option v-for="contact in contacts" :key="contact.userName" :value="contact.name || contact.userName">
                {{ contact.name || contact.userName }}
              </option>
            </select>
            <div v-if="contacts.length === 0" class="no-options-warning">
              ⚠️ No hay contactos disponibles en la agenda.
            </div>
          </div>
        </div>

        <!-- Modal Actions -->
        <div class="modal-actions">
          <button class="modal-btn cancel" @click="cancelConfigMode">{{ t('common.cancel') }}</button>
          <button class="modal-btn save" v-if="configStep === 2" @click="saveCardAction">
            {{ t('common.save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Confirm Delete -->
    <ConfirmModal
      v-if="showDeleteConfirm"
      :title="t('settings.rfid_settings.delete_btn')"
      :message="t('settings.rfid_settings.delete_confirm_desc')"
      confirm-class="delete"
      @confirm="confirmDeleteCard"
      @cancel="showDeleteConfirm = false"
    />
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

.glass-panel {
  background: rgba(255, 255, 255, 0.85);
  border-radius: 20px;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2.5rem;
}

.title {
  font-size: 2.8rem;
  font-weight: 700;
  color: #000;
}

.header-buttons {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.action-button.primary {
  background: #268cf2;
  color: white;
  border: none;
  padding: 1rem 2rem;
  font-size: 1.4rem;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.action-button.primary:active {
  transform: scale(0.95);
}

.icon-button {
  width: 4rem;
  height: 4rem;
  border-radius: 12px;
  background: white;
  border: 1px solid rgba(0,0,0,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.icon {
  width: 2rem;
  height: 2rem;
  object-fit: contain;
}

.content-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 2.5rem;
  gap: 2rem;
  overflow: hidden;
}

.instruction {
  font-size: 1.5rem;
  color: #444;
  text-align: center;
}

.cards-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-right: 1rem;
}

.empty-state {
  font-size: 1.8rem;
  color: #888;
  text-align: center;
  margin-top: 3rem;
}

.card-item {
  background: white;
  border: 2px solid rgba(0,0,0,0.85);
  border-radius: 16px;
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.card-id {
  font-size: 1.8rem;
  font-weight: 700;
  color: #000;
}

.card-action {
  font-size: 1.6rem;
  color: #555;
}

.extra-info {
  margin-left: 0.5rem;
  color: #268cf2;
  font-weight: 600;
}

.delete-btn-card {
  background: #db3333;
  color: white;
  border: none;
  padding: 0.8rem 2rem;
  font-size: 1.5rem;
  border-radius: 12px;
  cursor: pointer;
}

/* Modal */
.modal-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 700px;
  padding: 3rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  background: rgba(255,255,255,0.95);
}

.modal-title {
  font-size: 2.5rem;
  font-weight: 700;
  text-align: center;
}

.modal-step-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  padding: 2rem 0;
}

.spinner-container {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scanning-card-icon {
  width: 64px;
  height: 64px;
  object-fit: contain;
  z-index: 2;
}

.pulsing-circle {
  position: absolute;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: rgba(38, 140, 242, 0.2);
  animation: pulse 1.8s infinite ease-in-out;
  z-index: 1;
}

@keyframes pulse {
  0% {
    transform: scale(0.9);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.4;
  }
  100% {
    transform: scale(0.9);
    opacity: 0.8;
  }
}

.waiting-text {
  font-size: 1.6rem;
  color: #555;
  text-align: center;
  white-space: pre-wrap;
}

.modal-step-form {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.detected-id-badge {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  padding: 1rem 1.5rem;
  font-size: 1.8rem;
  text-align: center;
  border: 1px solid rgba(0,0,0,0.1);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.form-label {
  font-size: 1.6rem;
  font-weight: 700;
  color: #333;
}

.form-select {
  font-size: 1.8rem;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid #ccc;
  background: white;
  width: 100%;
}

.no-options-warning {
  font-size: 1.4rem;
  color: #db3333;
  margin-top: 0.2rem;
}

.modal-actions {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-top: 1rem;
}

.modal-btn {
  padding: 1rem 3rem;
  font-size: 1.6rem;
  font-weight: 700;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  color: white;
}

.modal-btn.cancel { background: #595959; }
.modal-btn.save { background: #33b24d; }
</style>
