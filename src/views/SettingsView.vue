<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const version = ref('...')
const deviceId = ref('...')

onMounted(async () => {
  const sys = await (window as any).config.getSystemInfo()
  version.value = sys.version
  deviceId.value = sys.deviceId
})

function goBack() {
  router.push('/')
}

function handleRestart() {
  if (confirm('¿Reiniciar aplicación?')) {
    (window as any).config.restartApp()
  }
}

function handleExit() {
  if (confirm('¿Salir al sistema?')) {
    (window as any).config.exitApp()
  }
}

const settingsButtons = [
  { id: 'lang', icon: '/images/language.png', label: 'Idioma', path: '#' },
  { id: 'cities', icon: '/images/weather.png', label: 'Ciudades', path: '/settings/weather' },
  { id: 'colors', icon: '/images/color.png', label: 'Colores Botones', path: '#' },
  { id: 'notif', icon: '/images/notif.png', label: 'Notificaciones', path: '#' },
  { id: 'rfid', icon: '/images/card.png', label: 'Tarjetas RFID', path: '#' },
  { id: 'audio', icon: '/images/audio.png', label: 'Audio', path: '#' },
  { id: 'logs', icon: '/images/logs.png', label: 'Logs del sistema', path: '#' },
  { id: 'launcher', icon: '/images/settings.png', label: 'Parámetros Launcher', path: '#' },
]
</script>

<template>
  <div class="view-container">
    <!-- Header -->
    <div class="header glass-panel">
      <div class="header-left">
        <h1 class="header-title">Configuración <span class="version-tag">v{{ version }}</span></h1>
      </div>

      <div class="header-actions">
        <button class="action-btn reboot" @click="handleRestart">Reiniciar</button>
        <button class="action-btn exit" @click="handleExit">Salir</button>
        <button class="back-btn" @click="goBack">
          <img src="/images/back.png" alt="Volver" />
        </button>
      </div>
    </div>

    <!-- Grid -->
    <div class="settings-grid glass-panel">
      <button 
        v-for="btn in settingsButtons" 
        :key="btn.id" 
        class="settings-card"
        @click="btn.path !== '#' ? router.push(btn.path) : null"
        :class="{ disabled: btn.path === '#' }"
      >
        <div class="card-icon-wrap">
          <img :src="btn.icon" :alt="btn.label" class="card-icon" />
        </div>
        <div class="card-label">{{ btn.label }}</div>
      </button>
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
  padding: 1.5rem 2rem;
  border-radius: 20px;
}

.header-title {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0;
  color: #111;
}

.version-tag {
  font-size: 1.2rem;
  font-weight: 600;
  color: #666;
  vertical-align: middle;
  margin-left: 0.5rem;
}

.device-id {
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent-blue);
  margin-top: 0.2rem;
}

.header-actions {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.action-btn {
  padding: 0.8rem 2rem;
  border-radius: 12px;
  border: none;
  font-size: 1.3rem;
  font-weight: 700;
  color: white;
  cursor: pointer;
  transition: transform 0.2s;
}

.action-btn:active { transform: scale(0.95); }

.action-btn.reboot { background: #e3920c; }
.action-btn.exit { background: #d92e2e; }

.back-btn {
  width: 4.5rem;
  height: 4.5rem;
  background: white;
  border: 2px solid #000;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.back-btn img {
  width: 2.8rem;
  height: 2.8rem;
}

.settings-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 2rem;
  padding: 3rem;
  border-radius: 20px;
}

.settings-card {
  background: white;
  border: 2.5px solid rgba(0, 0, 0, 0.15);
  border-radius: 24px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  cursor: pointer;
  transition: all 0.2s;
}

.settings-card:not(.disabled):hover {
  border-color: var(--accent-blue);
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  transform: translateY(-5px);
}

.settings-card:active { transform: scale(0.97); }

.settings-card.disabled {
  opacity: 0.6;
  cursor: default;
}

.card-icon-wrap {
  width: 8rem;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-icon {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.card-label {
  font-size: 1.8rem;
  font-weight: 600;
  color: #111;
  text-align: left;
  line-height: 1.2;
}
</style>
