<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  isActive: boolean
}>()

const emit = defineEmits(['close', 'missed', 'answered'])
const { t } = useI18n()

let timeoutId: any = null
const timeoutSeconds = 60

watch(() => props.isActive, (newVal) => {
  if (newVal) {
    startTimeout()
  } else {
    if (timeoutId) clearTimeout(timeoutId)
  }
})

onMounted(() => {
  if (props.isActive) {
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

async function answerEmotion(emotion: string) {
  if (timeoutId) clearTimeout(timeoutId)
  
  // Try sending it to backend
  try {
    if ((window as any).config && (window as any).config.submitEmotion) {
      await (window as any).config.submitEmotion(emotion)
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
        
        <div class="emotion-buttons">
          <button class="emotion-btn happy" @click="answerEmotion('Bien')">
            <span class="emoji">😀</span>
            <span class="label">{{ t('emotions.good') || 'Bien' }}</span>
          </button>
          
          <button class="emotion-btn neutral" @click="answerEmotion('Normal')">
            <span class="emoji">😐</span>
            <span class="label">{{ t('emotions.normal') || 'Normal' }}</span>
          </button>
          
          <button class="emotion-btn sad" @click="answerEmotion('Mal')">
            <span class="emoji">😢</span>
            <span class="label">{{ t('emotions.bad') || 'Triste / Mal' }}</span>
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
  width: 900px;
  max-width: 95vw;
  background: white;
  border-radius: 40px;
  padding: 4rem;
  box-shadow: 0 40px 100px rgba(0,0,0,0.4);
  transform: translateY(60px) scale(0.9);
  opacity: 0;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

.emotion-card.active {
  transform: translateY(0) scale(1);
  opacity: 1;
}

.emotion-title {
  font-size: 3.5rem;
  font-weight: 850;
  margin: 0;
  color: #111;
  text-align: center;
}

.emotion-subtitle {
  font-size: 1.8rem;
  color: #555;
  margin: 0 0 2rem 0;
  text-align: center;
}

.emotion-buttons {
  display: flex;
  gap: 3rem;
  width: 100%;
  justify-content: center;
}

.emotion-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  height: 250px;
  border-radius: 30px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #f8f9fa;
  box-shadow: 0 10px 30px rgba(0,0,0,0.08);
}

.emotion-btn:active {
  transform: scale(0.95);
}

.emotion-btn .emoji {
  font-size: 6rem;
}

.emotion-btn .label {
  font-size: 2rem;
  font-weight: 700;
  color: #333;
}

.emotion-btn.happy:hover {
  background: #dcfce7;
  box-shadow: 0 15px 40px rgba(34, 197, 94, 0.2);
}

.emotion-btn.neutral:hover {
  background: #fef08a;
  box-shadow: 0 15px 40px rgba(234, 179, 8, 0.2);
}

.emotion-btn.sad:hover {
  background: #fee2e2;
  box-shadow: 0 15px 40px rgba(239, 68, 68, 0.2);
}
</style>
