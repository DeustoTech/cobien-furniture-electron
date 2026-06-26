<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()

interface WifiNetwork {
  ssid: string
  signal: number
  security: string
  active: boolean
}

const networks = ref<WifiNetwork[]>([])
const currentWifi = ref<string | null>(null)
const scanning = ref(false)
const connecting = ref(false)
const connectionError = ref(false)

// Password Dialog ref
const selectedNetwork = ref<WifiNetwork | null>(null)
const password = ref('')
const showPasswordModal = ref(false)

// Keyboard state
const isShift = ref(false)
const isSymbols = ref(false)

const normalKeysRow2 = ['q','w','e','r','t','y','u','i','o','p']
const normalKeysRow3 = ['a','s','d','f','g','h','j','k','l']
const normalKeysRow4 = ['z','x','c','v','b','n','m']

const symbolKeysRow2 = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')']
const symbolKeysRow3 = ['-', '_', '=', '+', '[', ']', '{', '}', ';', ':']
const symbolKeysRow4 = ["'", '"', ',', '.', '<', '>', '/', '?', '\\', '|']

async function loadWifiStatus() {
  try {
    currentWifi.value = await (window as any).config.getCurrentWifi()
  } catch (err) {
    console.error('Failed to get current wifi:', err)
  }
}

async function scan() {
  if (scanning.value) return
  scanning.value = true
  try {
    networks.value = await (window as any).config.scanWifi()
    await loadWifiStatus()
  } catch (err) {
    console.error('Failed to scan wifi:', err)
  } finally {
    scanning.value = false
  }
}

function selectNetwork(net: WifiNetwork) {
  if (net.active) return // Already connected

  selectedNetwork.value = net
  password.value = ''
  
  // If the network is open (no security), connect immediately
  const hasSecurity = net.security && net.security.trim().length > 0 && !net.security.toLowerCase().includes('open')
  if (!hasSecurity) {
    connect(net.ssid)
  } else {
    showPasswordModal.value = true
  }
}

async function connect(ssid: string, pass?: string) {
  connecting.value = true
  connectionError.value = false
  showPasswordModal.value = false

  try {
    const success = await (window as any).config.connectWifi(ssid, pass)
    if (success) {
      currentWifi.value = ssid
      await scan()
    } else {
      connectionError.value = true
    }
  } catch (err) {
    console.error('Connection error:', err)
    connectionError.value = true
  } finally {
    connecting.value = false
  }
}

function handleKeyClick(key: string) {
  if (key === 'Backspace') {
    password.value = password.value.slice(0, -1)
  } else if (key === 'Space') {
    password.value += ' '
  } else if (key === 'Shift') {
    isShift.value = !isShift.value
  } else if (key === 'Symbols') {
    isSymbols.value = !isSymbols.value
  } else {
    password.value += key
  }
}

function closePasswordModal() {
  showPasswordModal.value = false
  selectedNetwork.value = null
  password.value = ''
}

function goBack() {
  router.push('/settings')
}

onMounted(() => {
  scan()
})
</script>

<template>
  <div class="view-container">
    <!-- Header -->
    <div class="header glass-panel">
      <div class="header-left">
        <h1 class="header-title">{{ t('settings.wifi_settings_title') }}</h1>
        <div class="connection-status">
          <span class="status-dot" :class="{ connected: currentWifi, connecting: connecting }"></span>
          <span v-if="connecting">{{ t('settings.wifi_status_connecting', { ssid: selectedNetwork?.ssid }) }}</span>
          <span v-else-if="currentWifi">{{ t('settings.wifi_status_connected', { ssid: currentWifi }) }}</span>
          <span v-else>{{ t('settings.wifi_status_disconnected') }}</span>
        </div>
      </div>
      <div class="header-actions">
        <button class="action-btn scan" @click="scan" :disabled="scanning">
          <span v-if="scanning">⏳ {{ t('common.loading') }}</span>
          <span v-else>🔄 {{ t('settings.wifi_refresh') }}</span>
        </button>
        <button class="back-btn" @click="goBack">
          <img src="/images/back.png" :alt="t('common.back')" />
        </button>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="settings-content glass-panel scrollable-list">
      <!-- Error message -->
      <div v-if="connectionError" class="error-banner">
        ⚠️ {{ t('settings.wifi_failed_status') }}
      </div>

      <div v-if="networks.length === 0 && !scanning" class="empty-list">
        {{ t('settings.wifi_status_disconnected') }}
      </div>

      <div class="wifi-networks-grid">
        <div 
          v-for="net in networks" 
          :key="net.ssid" 
          class="wifi-card"
          :class="{ active: net.active, connected: currentWifi === net.ssid }"
          @click="selectNetwork(net)"
        >
          <div class="wifi-info">
            <span class="wifi-ssid">{{ net.ssid }}</span>
            <span class="wifi-security-badge" v-if="net.security">
              {{ net.security }}
            </span>
          </div>

          <div class="wifi-meta">
            <!-- Signal strength bar -->
            <div class="signal-indicator" :title="`Signal: ${net.signal}%`">
              <div class="signal-bar" :style="{ height: '25%', opacity: net.signal >= 20 ? 1 : 0.3 }"></div>
              <div class="signal-bar" :style="{ height: '50%', opacity: net.signal >= 45 ? 1 : 0.3 }"></div>
              <div class="signal-bar" :style="{ height: '75%', opacity: net.signal >= 70 ? 1 : 0.3 }"></div>
              <div class="signal-bar" :style="{ height: '100%', opacity: net.signal >= 85 ? 1 : 0.3 }"></div>
            </div>

            <!-- Lock icon for secure wifi -->
            <div class="security-icon" v-if="net.security && !net.security.toLowerCase().includes('open')">
              🔒
            </div>

            <div class="active-indicator" v-if="currentWifi === net.ssid">
              ✔️
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Password Input Modal with Premium Alphanumeric Virtual Keyboard -->
    <div class="modal-overlay" v-if="showPasswordModal">
      <div class="keyboard-modal glass-panel">
        <div class="modal-header">
          <h3>{{ t('settings.wifi_password_prompt', { ssid: selectedNetwork?.ssid }) }}</h3>
          <button class="close-modal" @click="closePasswordModal">✕</button>
        </div>

        <div class="password-input-wrapper">
          <input 
            type="password" 
            class="password-field" 
            v-model="password" 
            readonly 
            :placeholder="t('settings.wifi_password')"
          />
          <button 
            class="connect-btn" 
            :disabled="password.length < 4" 
            @click="connect(selectedNetwork!.ssid, password)"
          >
            {{ t('settings.wifi_connect_btn') }}
          </button>
        </div>

        <!-- Virtual Alphanumeric Keyboard -->
        <div class="virtual-keyboard">
          <!-- Row 1: Numbers -->
          <div class="keyboard-row">
            <button 
              v-for="k in ['1','2','3','4','5','6','7','8','9','0']" 
              :key="k" 
              class="k-key" 
              @click="handleKeyClick(k)"
            >
              {{ k }}
            </button>
          </div>

          <!-- Row 2: QWERTY / Symbols -->
          <div class="keyboard-row">
            <button 
              v-for="k in (isSymbols ? symbolKeysRow2 : normalKeysRow2)" 
              :key="k" 
              class="k-key" 
              @click="handleKeyClick(isShift && !isSymbols ? k.toUpperCase() : k)"
            >
              {{ isShift && !isSymbols ? k.toUpperCase() : k }}
            </button>
          </div>

          <!-- Row 3: ASDFGHJKL / Symbols -->
          <div class="keyboard-row">
            <button 
              v-for="k in (isSymbols ? symbolKeysRow3 : normalKeysRow3)" 
              :key="k" 
              class="k-key" 
              @click="handleKeyClick(isShift && !isSymbols ? k.toUpperCase() : k)"
            >
              {{ isShift && !isSymbols ? k.toUpperCase() : k }}
            </button>
          </div>

          <!-- Row 4: Shift ZXCVBNM Backspace -->
          <div class="keyboard-row">
            <button class="k-key special shift" :class="{ active: isShift }" @click="handleKeyClick('Shift')">
              ⇧
            </button>
            <button 
              v-for="k in (isSymbols ? symbolKeysRow4 : normalKeysRow4)" 
              :key="k" 
              class="k-key" 
              @click="handleKeyClick(isShift && !isSymbols ? k.toUpperCase() : k)"
            >
              {{ isShift && !isSymbols ? k.toUpperCase() : k }}
            </button>
            <button class="k-key special backspace" @click="handleKeyClick('Backspace')">
              ⌫
            </button>
          </div>

          <!-- Row 5: Symbols Space Connection -->
          <div class="keyboard-row">
            <button class="k-key special mode-toggle" @click="handleKeyClick('Symbols')">
              {{ isSymbols ? 'ABC' : '?123' }}
            </button>
            <button class="k-key spacebar" @click="handleKeyClick('Space')">
              Space
            </button>
            <button 
              class="k-key special enter" 
              :disabled="password.length < 4" 
              @click="connect(selectedNetwork!.ssid, password)"
            >
              Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  height: 100vh;
  padding: 4rem 3rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.2rem;
  font-weight: 600;
  color: #555;
  margin-top: 0.3rem;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #d92e2e;
}

.status-dot.connected {
  background: #1a7f37;
}

.status-dot.connecting {
  background: #e3920c;
  animation: pulse 1.2s infinite alternate;
}

@keyframes pulse {
  0% { opacity: 0.3; }
  100% { opacity: 1; }
}

.back-btn {
  width: 5.5rem;
  height: 5.5rem;
  background: white;
  border: 2px solid #000;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.back-btn img {
  width: 3.5rem;
  height: 3.5rem;
}

.action-btn.scan {
  padding: 0.8rem 1.8rem;
  border-radius: 12px;
  border: 2px solid #000;
  font-size: 1.2rem;
  font-weight: 700;
  background: white;
  cursor: pointer;
  height: 5.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn.scan:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.settings-content {
  flex: 1;
  padding: 2.5rem;
  border-radius: 24px;
  overflow-y: auto;
}

.wifi-networks-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.wifi-card {
  background: rgba(255, 255, 255, 0.7);
  border: 2px solid rgba(0, 0, 0, 0.05);
  border-radius: 16px;
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.wifi-card:hover {
  background: white;
  border-color: rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.wifi-card.connected {
  border-color: #1a7f37;
  background: rgba(26, 127, 55, 0.05);
}

.wifi-info {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.wifi-ssid {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111;
}

.wifi-security-badge {
  font-size: 0.85rem;
  font-weight: 700;
  color: #666;
  background: rgba(0, 0, 0, 0.05);
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  width: fit-content;
}

.wifi-meta {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.signal-indicator {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  width: 25px;
  height: 20px;
}

.signal-bar {
  flex: 1;
  background: #333;
  border-radius: 1px;
  transition: all 0.2s;
}

.security-icon {
  font-size: 1.3rem;
}

.active-indicator {
  font-size: 1.5rem;
}

.empty-list {
  text-align: center;
  font-size: 1.4rem;
  color: #777;
  padding: 4rem;
}

.error-banner {
  background: rgba(207, 34, 46, 0.1);
  color: #cf222e;
  border: 1.5px solid rgba(207, 34, 46, 0.2);
  padding: 1rem 1.5rem;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1.2rem;
  margin-bottom: 1.5rem;
}

/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  z-index: 1000;
}

.keyboard-modal {
  width: 90%;
  max-width: 900px;
  border-radius: 24px 24px 0 0;
  padding: 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  box-shadow: 0 -10px 40px rgba(0,0,0,0.15);
  border-bottom: none;
  animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  font-size: 1.5rem;
  font-weight: 800;
  color: #111;
  margin: 0;
}

.close-modal {
  background: rgba(0,0,0,0.05);
  border: none;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
}

.password-input-wrapper {
  display: flex;
  gap: 1rem;
}

.password-field {
  flex: 1;
  padding: 1rem 1.5rem;
  font-size: 1.5rem;
  border: 2px solid rgba(0,0,0,0.1);
  border-radius: 14px;
  background: white;
  letter-spacing: 0.15em;
  font-family: monospace;
}

.connect-btn {
  padding: 0 2rem;
  background: #1a7f37;
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
}

.connect-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Virtual Keyboard */
.virtual-keyboard {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  background: rgba(0, 0, 0, 0.03);
  padding: 1rem;
  border-radius: 16px;
}

.keyboard-row {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}

.k-key {
  flex: 1;
  height: 3.8rem;
  background: white;
  border: 1.5px solid rgba(0,0,0,0.08);
  border-radius: 10px;
  font-size: 1.25rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s, transform 0.1s;
}

.k-key:active {
  background: #f0f0f0;
  transform: scale(0.95);
}

.k-key.special {
  background: rgba(0, 0, 0, 0.06);
  flex: 1.5;
  font-size: 1.1rem;
}

.k-key.special.active {
  background: #333;
  color: white;
}

.k-key.special.backspace {
  font-size: 1.3rem;
}

.k-key.spacebar {
  flex: 5;
  background: white;
}

.k-key.special.enter {
  background: #1a7f37;
  color: white;
  flex: 2;
  font-size: 1.1rem;
}

.k-key.special.enter:disabled {
  opacity: 0.5;
}
</style>
