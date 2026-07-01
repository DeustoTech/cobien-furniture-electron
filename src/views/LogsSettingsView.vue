<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()

const logTypes = ref<string[]>([])
const activeType = ref('app')
const logContent = ref('')
const terminalRef = ref<HTMLDivElement | null>(null)
let refreshTimer: ReturnType<typeof setInterval> | null = null

function goBack() {
  router.push('/settings')
}

async function loadLogTypes() {
  try {
    logTypes.value = await (window as any).config.getLogTypes()
  } catch (e) {
    logTypes.value = ['app', 'icso', 'can', 'bridge']
  }
}

async function fetchLogTail() {
  try {
    const text = await (window as any).config.getLogTail(activeType.value)
    logContent.value = text || t('common.no_data')
  } catch (e: any) {
    logContent.value = `Error loading logs: ${e.message}`
  }
}

function selectLogType(type: string) {
  activeType.value = type
  logContent.value = t('common.loading')
  fetchLogTail()
}

function scrollToBottom() {
  if (terminalRef.value) {
    terminalRef.value.scrollTop = terminalRef.value.scrollHeight
  }
}

watch(logContent, () => {
  nextTick(() => {
    scrollToBottom()
  })
})

onMounted(async () => {
  await loadLogTypes()
  await fetchLogTail()
  
  // Refrescar cada 1.5 segundos
  refreshTimer = setInterval(() => {
    fetchLogTail()
  }, 1500)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>

<template>
  <div class="view-container">
    <!-- Header -->
    <div class="header glass-panel">
      <div class="header-left">
        <h1 class="header-title">{{ t('settings.logs') }}</h1>
      </div>
      <button class="back-btn" @click="goBack">
        <img src="/images/back.png" :alt="t('common.back')" />
      </button>
    </div>

    <!-- Body Layout -->
    <div class="logs-layout">
      <!-- Sidebar -->
      <div class="logs-sidebar glass-panel">
        <button
          v-for="type in logTypes"
          :key="type"
          class="sidebar-btn"
          :class="{ active: activeType === type }"
          @click="selectLogType(type)"
        >
          <span class="btn-icon">📋</span>
          <span class="btn-text">{{ t(`settings.logs_${type}`) }}</span>
        </button>
      </div>

      <!-- Console Viewer -->
      <div class="console-viewer glass-panel">
        <div ref="terminalRef" class="terminal-container">
          <pre class="terminal-text">{{ logContent }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  height: 100vh;
  padding: 4rem 3rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  box-sizing: border-box;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2rem 2rem;
  border-radius: 20px;
}

.logs-layout {
  display: flex;
  flex: 1;
  gap: 1.5rem;
  min-height: 0; /* Important for flex child scroll */
}

/* Sidebar Styling */
.logs-sidebar {
  flex: 0 0 280px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 20px;
}

.sidebar-btn {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.2rem 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.4);
  color: #333;
  border-radius: 14px;
  font-size: 1.4rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.sidebar-btn:hover {
  background: rgba(255, 255, 255, 0.7);
  transform: translateY(-2px);
}

.sidebar-btn.active {
  background: #0f172a;
  color: #ffffff;
  border-color: #0f172a;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
}

.btn-icon {
  font-size: 1.6rem;
}

.btn-text {
  flex: 1;
}

/* Terminal Console Styling */
.console-viewer {
  flex: 1;
  border-radius: 20px;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  min-height: 0; /* Critical for inner scrolling */
}

.terminal-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  padding: 1rem;
  scroll-behavior: smooth;
}

/* Custom Terminal Scrollbar */
.terminal-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.terminal-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}
.terminal-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}
.terminal-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}

.terminal-text {
  margin: 0;
  font-family: 'Fira Code', 'Courier New', Courier, monospace;
  font-size: 1.25rem;
  line-height: 1.6;
  color: #a7f3d0; /* Soft emerald green for terminal readability */
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
