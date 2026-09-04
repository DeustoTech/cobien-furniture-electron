<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  isActive: boolean
}>()

const emit = defineEmits(['close', 'missed', 'answered'])
const { t } = useI18n()

let timeoutId: any = null
const timeoutSeconds = 60

const selectedStatements = ref<string[]>([])
const currentHour = ref(new Date().getHours())

const isMorning = computed(() => currentHour.value < 10)
const isNight = computed(() => currentHour.value >= 20)

watch(() => props.isActive, (newVal) => {
  if (newVal) {
    currentHour.value = new Date().getHours()
    selectedStatements.value = []
    startTimeout()
  } else {
    if (timeoutId) clearTimeout(timeoutId)
  }
})

onMounted(() => {
  if (props.isActive) {
    currentHour.value = new Date().getHours()
    selectedStatements.value = []
    startTimeout()
  }
})

onUnmounted(() => {
  if (timeoutId) clearTimeout(timeoutId)
})

function startTimeout() {
  if (timeoutId) clearTimeout(timeoutId)
  timeoutId = setTimeout(() => {
    emit('missed')
  }, timeoutSeconds * 1000)
}

function toggleStatement(key: string) {
  const idx = selectedStatements.value.indexOf(key)
  if (idx >= 0) {
    selectedStatements.value.splice(idx, 1)
  } else {
    selectedStatements.value.push(key)
  }
}

async function answerEmotion(emotion: string) {
  if (timeoutId) clearTimeout(timeoutId)
  
  const payload = {
    emotion,
    statements: [...selectedStatements.value],
    period: isMorning.value ? 'morning' : isNight.value ? 'night' : 'standard',
    timestamp: new Date().toISOString()
  }

  try {
    if ((window as any).config && (window as any).config.submitEmotion) {
      await (window as any).config.submitEmotion(payload)
    }
  } catch (e) {
    console.error('Failed to submit emotion', e)
  }

  emit('answered', emotion)
}
</script>

<template>
  <Teleport defer to="body">
    <div class="emotion-overlay" :class="{ active: isActive }">
      <div class="emotion-card glass-panel" :class="{ active: isActive }">
        <h1 class="emotion-title">{{ t('emotions.how_are_you') || '¿Cómo te encuentras hoy?' }}</h1>
        <p class="emotion-subtitle">{{ t('emotions.select_option') || 'Por favor, selecciona una opción:' }}</p>
        
        <!-- Frases Contextuales de Mañana (< 10:00h) -->
        <div v-if="isMorning" class="context-section">
          <h2 class="context-title">{{ t('emotions.morning_title') || 'Cuéntanos sobre tu descanso:' }}</h2>
          <div class="context-chips">
            <button 
              class="context-chip" 
              :class="{ selected: selectedStatements.includes('slept_well') }" 
              @click="toggleStatement('slept_well')"
            >
              <span class="chip-icon">{{ selectedStatements.includes('slept_well') ? '✓' : '+' }}</span>
              <span class="chip-text">{{ t('emotions.slept_well') || 'He dormido bien esta noche' }}</span>
            </button>

            <button 
              class="context-chip" 
              :class="{ selected: selectedStatements.includes('feel_rested') }" 
              @click="toggleStatement('feel_rested')"
            >
              <span class="chip-icon">{{ selectedStatements.includes('feel_rested') ? '✓' : '+' }}</span>
              <span class="chip-text">{{ t('emotions.feel_rested') || 'Me siento descansado' }}</span>
            </button>
          </div>
        </div>

        <!-- Frases Contextuales de Noche (>= 20:00h) -->
        <div v-if="isNight" class="context-section">
          <h2 class="context-title">{{ t('emotions.night_title') || '¿Cómo ha ido tu día?' }}</h2>
          <div class="context-chips">
            <button 
              class="context-chip" 
              :class="{ selected: selectedStatements.includes('felt_loved') }" 
              @click="toggleStatement('felt_loved')"
            >
              <span class="chip-icon">{{ selectedStatements.includes('felt_loved') ? '✓' : '+' }}</span>
              <span class="chip-text">{{ t('emotions.felt_loved') || 'Hoy me he sentido querido' }}</span>
            </button>

            <button 
              class="context-chip" 
              :class="{ selected: selectedStatements.includes('felt_accompanied') }" 
              @click="toggleStatement('felt_accompanied')"
            >
              <span class="chip-icon">{{ selectedStatements.includes('felt_accompanied') ? '✓' : '+' }}</span>
              <span class="chip-text">{{ t('emotions.felt_accompanied') || 'Hoy me he sentido acompañado' }}</span>
            </button>

            <button 
              class="context-chip" 
              :class="{ selected: selectedStatements.includes('good_day') }" 
              @click="toggleStatement('good_day')"
            >
              <span class="chip-icon">{{ selectedStatements.includes('good_day') ? '✓' : '+' }}</span>
              <span class="chip-text">{{ t('emotions.good_day') || 'Hoy ha sido un buen día para mí' }}</span>
            </button>
          </div>
        </div>

        <!-- Botones de Emoción Principal (5 niveles) -->
        <div class="emotion-buttons">
          <button class="emotion-btn excellent" @click="answerEmotion('Excelente')">
            <span class="emoji">😄</span>
            <span class="label">{{ t('emotions.excellent') || 'Excelente' }}</span>
          </button>

          <button class="emotion-btn good" @click="answerEmotion('Bien')">
            <span class="emoji">🙂</span>
            <span class="label">{{ t('emotions.good') || 'Bien' }}</span>
          </button>
          
          <button class="emotion-btn average" @click="answerEmotion('Normal')">
            <span class="emoji">😐</span>
            <span class="label">{{ t('emotions.normal') || 'Normal' }}</span>
          </button>

          <button class="emotion-btn poor" @click="answerEmotion('Regular')">
            <span class="emoji">🙁</span>
            <span class="label">{{ t('emotions.poor') || 'Regular' }}</span>
          </button>
          
          <button class="emotion-btn bad" @click="answerEmotion('Muy mal')">
            <span class="emoji">😢</span>
            <span class="label">{{ t('emotions.bad') || 'Muy mal' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.emotion-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0);
  backdrop-filter: blur(0px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 13000;
  transition: all 0.4s ease;
  pointer-events: none;
}

.emotion-overlay.active {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  pointer-events: all;
}

.emotion-card {
  width: 960px;
  max-width: 95vw;
  background: white;
  border-radius: 40px;
  padding: 3rem 2rem;
  box-shadow: 0 40px 100px rgba(0,0,0,0.4);
  transform: translateY(60px) scale(0.9);
  opacity: 0;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.emotion-card.active {
  transform: translateY(0) scale(1);
  opacity: 1;
}

.emotion-title {
  font-size: 3.2rem;
  font-weight: 850;
  margin: 0;
  color: #111;
  text-align: center;
}

.emotion-subtitle {
  font-size: 1.6rem;
  color: #555;
  margin: 0;
  text-align: center;
}

/* Contextual phrases section */
.context-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  background: #f1f5f9;
  border-radius: 28px;
  padding: 1.5rem 2rem;
  border: 2px solid #cbd5e1;
}

.context-title {
  font-size: 1.85rem;
  font-weight: 800;
  color: #1e293b;
  margin: 0;
  text-align: center;
}

.context-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 1.2rem;
  justify-content: center;
  width: 100%;
}

.context-chip {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 1.1rem 2rem;
  border-radius: 50px;
  border: 3px solid #94a3b8;
  background: #ffffff;
  color: #1e293b;
  font-size: 1.7rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

.context-chip:active {
  transform: scale(0.96);
}

.context-chip.selected {
  background: #2563eb;
  border-color: #1d4ed8;
  color: #ffffff;
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.4);
}

.chip-icon {
  font-size: 1.8rem;
  font-weight: 900;
}

.emotion-buttons {
  display: flex;
  gap: 1.25rem;
  width: 100%;
  justify-content: center;
}

.emotion-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  height: 200px;
  border-radius: 28px;
  border: 4px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #f8f9fa;
  box-shadow: 0 10px 30px rgba(0,0,0,0.08);
}

.emotion-btn:active {
  transform: scale(0.95);
}

.emotion-btn .emoji {
  font-size: 4.5rem;
}

.emotion-btn .label {
  font-size: 1.4rem;
  font-weight: 700;
  color: #333;
  text-align: center;
  word-break: break-word;
}

/* Default state borders */
.emotion-btn.excellent {
  border-color: #16a34a;
}

.emotion-btn.good {
  border-color: #65a30d;
}

.emotion-btn.average {
  border-color: #ca8a04;
}

.emotion-btn.poor {
  border-color: #ea580c;
}

.emotion-btn.bad {
  border-color: #dc2626;
}

/* Hover state borders and tints */
.emotion-btn.excellent:hover {
  background: #dcfce7;
  border-color: #15803d;
  box-shadow: 0 15px 40px rgba(22, 163, 74, 0.3);
}

.emotion-btn.good:hover {
  background: #ecfccb;
  border-color: #4d7c0f;
  box-shadow: 0 15px 40px rgba(101, 163, 13, 0.3);
}

.emotion-btn.average:hover {
  background: #fef08a;
  border-color: #a16207;
  box-shadow: 0 15px 40px rgba(202, 138, 4, 0.3);
}

.emotion-btn.poor:hover {
  background: #ffedd5;
  border-color: #c2410c;
  box-shadow: 0 15px 40px rgba(234, 88, 12, 0.3);
}

.emotion-btn.bad:hover {
  background: #fee2e2;
  border-color: #991b1b;
  box-shadow: 0 15px 40px rgba(220, 38, 38, 0.3);
}
</style>
