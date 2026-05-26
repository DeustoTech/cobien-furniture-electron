<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ConfirmModal from '../components/ConfirmModal.vue'

const router = useRouter()
const { t } = useI18n()

// State
const catalog = ref<string[]>([])
const activeCities = ref<string[]>([])
const primaryCity = ref<string>('')
const selectedLetter = ref<string | null>(null)

// Modal state
const isModalOpen = ref(false)
const newCityName = ref('')
const validationError = ref('')
const isValidating = ref(false)

// Delete confirm state
const showDeleteConfirm = ref(false)
const cityToDelete = ref('')

onMounted(async () => {
  await loadConfig()
})

async function loadConfig() {
  try {
    const data = await (window as any).config.getWeather()
    catalog.value = data.catalog || []
    activeCities.value = data.active || []
    primaryCity.value = data.primary || ''
  } catch (e) {
    console.error('Failed to load config', e)
  }
}

async function saveConfig() {
  try {
    // Strip Vue Proxies by deep cloning before sending via IPC
    const payload = JSON.parse(JSON.stringify({
      catalog: catalog.value,
      active: activeCities.value,
      primary: primaryCity.value
    }))
    await (window as any).config.saveWeather(payload)
  } catch (e) {
    console.error('Failed to save config', e)
  }
}

const availableLetters = computed(() => {
  const letters = new Set<string>()
  const source = activeCities.value.length > 0 ? activeCities.value : catalog.value
  source.forEach(city => {
    if (city.trim()) letters.add(city.trim().charAt(0).toUpperCase())
  })
  return Array.from(letters).sort()
})

const filteredCities = computed(() => {
  if (!selectedLetter.value) return catalog.value
  return catalog.value.filter(city => city.trim().charAt(0).toUpperCase() === selectedLetter.value)
})

function setLetterFilter(letter: string | null) {
  selectedLetter.value = letter
}

async function toggleCity(city: string) {
  if (activeCities.value.includes(city)) {
    activeCities.value = activeCities.value.filter(c => c !== city)
  } else {
    activeCities.value.push(city)
  }
  await saveConfig()
}

async function setPrimary(city: string) {
  primaryCity.value = city
  await saveConfig()
}

function deleteCity(city: string) {
  cityToDelete.value = city
  showDeleteConfirm.value = true
}

async function confirmDeleteCity() {
  const city = cityToDelete.value
  showDeleteConfirm.value = false
  if (!city) return
  
  catalog.value = catalog.value.filter(c => c !== city)
  activeCities.value = activeCities.value.filter(c => c !== city)
  if (primaryCity.value === city) primaryCity.value = ''
  await saveConfig()
  cityToDelete.value = ''
}

function openAddModal() {
  newCityName.value = ''
  validationError.value = ''
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
}

async function saveNewCity() {
  const city = newCityName.value.trim()
  if (!city) {
    validationError.value = t('weather_settings.error_empty')
    return
  }
  if (catalog.value.find(c => c.toLowerCase() === city.toLowerCase())) {
    validationError.value = t('weather_settings.error_exists')
    return
  }

  isValidating.value = true
  validationError.value = ""
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`, {
      headers: { 'User-Agent': 'CoBien-Electron-App' }
    })
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      // Valid city
      catalog.value.push(city)
      activeCities.value.push(city)
      await saveConfig()
      closeModal()
    } else {
      validationError.value = t('weather_settings.error_invalid')
    }
  } catch(e) {
    validationError.value = t('weather_settings.error_network')
  } finally {
    isValidating.value = false
  }
}

function goBack() {
  router.push('/settings')
}
</script>

<template>
  <div class="view-container">
    
    <!-- Header -->
    <div class="header glass-panel">
      <div class="title">{{ t('weather_settings.title') }}</div>
      <div class="header-buttons">
        <button class="action-button primary" @click="openAddModal">{{ t('weather_settings.add_city') }}</button>
        <button class="icon-button" @click="goBack">
          <img src="/images/back.png" :alt="t('weather_settings.back')" class="icon" />
        </button>
      </div>
    </div>

    <!-- Instruction & Letters -->
    <div class="content-box glass-panel">
      <div class="instruction">{{ t('weather_settings.instruction') }}</div>
      
      <div class="letters-row">
        <button 
          :class="['letter-btn', { active: selectedLetter === null }]" 
          @click="setLetterFilter(null)"
        >{{ t('weather_settings.all') }}</button>
        <button 
          v-for="letter in availableLetters" :key="letter"
          :class="['letter-btn', { active: selectedLetter === letter }]"
          @click="setLetterFilter(letter)"
        >{{ letter }}</button>
      </div>

      <!-- Cities List -->
      <div class="cities-list">
        <div class="empty-state" v-if="filteredCities.length === 0">
          {{ t('weather_settings.no_cities') }}
        </div>
        <div class="city-card" v-for="city in filteredCities" :key="city">
          <div class="city-name" :class="{ bold: activeCities.includes(city) }">{{ city }}</div>
          <div class="city-actions">
            <button 
              class="card-btn toggle-btn" 
              :class="{ active: activeCities.includes(city) }"
              @click="toggleCity(city)"
            >
              {{ activeCities.includes(city) ? t('weather_settings.active_label') : t('weather_settings.activate_btn') }}
            </button>
            <button class="card-btn delete-btn" @click="deleteCity(city)">{{ t('weather_settings.delete_btn') }}</button>
            <button 
              class="card-btn priority-btn"
              :class="{ active: primaryCity === city }"
              @click="setPrimary(city)"
            >
              {{ primaryCity === city ? t('weather_settings.primary_label') : t('weather_settings.prioritize_btn') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add City Modal -->
    <div class="modal-overlay" v-if="isModalOpen">
      <div class="modal-content glass-panel">
        <div class="modal-title">{{ t('weather_settings.add_modal_title') }}</div>
        <input 
          type="text" 
          class="modal-input" 
          :placeholder="t('weather_settings.city_placeholder')" 
          v-model="newCityName"
          @keyup.enter="saveNewCity"
        />
        <div class="validation-error">{{ validationError }}</div>
        
        <div class="modal-actions">
          <button class="modal-btn cancel" @click="closeModal">{{ t('weather_settings.cancel_btn') }}</button>
          <button class="modal-btn save" @click="saveNewCity" :disabled="isValidating">
            {{ isValidating ? t('weather_settings.validating') : t('weather_settings.save_btn') }}
          </button>
        </div>
      </div>
    </div>
    
    <ConfirmModal
      v-if="showDeleteConfirm"
      :title="t('weather_settings.delete_btn')"
      :message="t('weather_settings.delete_confirm', { city: cityToDelete })"
      confirm-class="delete"
      @confirm="confirmDeleteCity"
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

.letters-row {
  display: flex;
  gap: 0.8rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.letter-btn {
  background: white;
  border: 1px solid rgba(0,0,0,0.1);
  padding: 0.8rem 1.2rem;
  font-size: 1.4rem;
  border-radius: 8px;
  cursor: pointer;
  min-width: 4rem;
}

.letter-btn.active {
  background: #333;
  color: white;
}

.cities-list {
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

.city-card {
  background: white;
  border: 2px solid rgba(0,0,0,0.85);
  border-radius: 16px;
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.city-name {
  font-size: 2rem;
  color: #000;
}

.city-name.bold {
  font-weight: 700;
}

.city-actions {
  display: flex;
  gap: 1rem;
}

.card-btn {
  padding: 0.8rem 2rem;
  font-size: 1.5rem;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  color: white;
  min-width: 150px;
}

.toggle-btn { background: #268cf2; }
.toggle-btn.active { background: #33b24d; }

.delete-btn { background: #db3333; }

.priority-btn { background: #595959; }
.priority-btn.active { background: #f2a626; }

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
  width: 800px;
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

.modal-input {
  font-size: 2rem;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  border: 1px solid #ccc;
  width: 100%;
}

.validation-error {
  color: #d91c1c;
  font-size: 1.5rem;
  text-align: center;
  min-height: 2rem;
}

.modal-actions {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-top: 1rem;
}

.modal-btn {
  padding: 1rem 3rem;
  font-size: 1.8rem;
  font-weight: 700;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  color: white;
}

.modal-btn.cancel { background: #268cf2; }
.modal-btn.save { background: #268cf2; }
.modal-btn:disabled { opacity: 0.5; }
</style>
