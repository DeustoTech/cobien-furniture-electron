<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  isActive: boolean
}>()

const emit = defineEmits(['close', 'missed', 'answered', 'request-call'])
const { t } = useI18n()

let timeoutId: any = null
let feedbackTimeoutId: any = null
const timeoutSeconds = 300 // 5 minutes inactivity timeout for questions
const feedbackSeconds = 30 // 30 seconds auto-dismiss for feedback screen

// Wizard Steps: 1 = Question 1, 2 = Question 2, 3 = Feedback Screen
const step = ref<1 | 2 | 3>(1)
const currentHour = ref(new Date().getHours())

// Morning if before 14:00 (document specifies 7-8h), otherwise Evening/Night (19-20h)
const isMorning = computed(() => currentHour.value < 14)

const q1Answer = ref<string>('')
const q1Score = ref<number>(0)
const q2Answer = ref<string>('')
const q2Score = ref<number>(0)
const feedbackProgress = ref<number>(100)
let feedbackIntervalId: any = null

const totalScore = computed(() => q1Score.value + q2Score.value)

const feedbackRange = computed<'A' | 'B' | 'C'>(() => {
  const score = totalScore.value
  if (score <= 3) return 'A'
  if (score <= 5) return 'B'
  return 'C'
})

const feedbackMessage = computed(() => {
  const range = feedbackRange.value
  if (isMorning.value) {
    if (range === 'A') return t('emotions.morning_feedback_a') || 'Entendido. Si el cuerpo o el ánimo pesan hoy, ve poco a poco. Que tengas un buen día. Acuérdate de que siempre puedes solicitar una llamada.'
    if (range === 'B') return t('emotions.morning_feedback_b') || 'Comprendido. Que tengas un buen día. Acuérdate de que siempre puedes solicitar una llamada.'
    return t('emotions.morning_feedback_c') || 'Genial. Empezar el día con buen descanso y energía es bueno. Que tengas un buen día. Acuérdate de que siempre puedes solicitar una llamada.'
  } else {
    if (range === 'A') return t('emotions.night_feedback_a') || 'Veo que ha sido un día duro. Intenta descansar. Que tengas una buena noche.'
    if (range === 'B') return t('emotions.night_feedback_b') || 'Entendido. Es momento de desconectar y descansar. Que tengas una buena noche.'
    return t('emotions.night_feedback_c') || 'Genial. Parece que has tenido un buen día. Que tengas una buena noche.'
  }
})

const feedbackIcon = computed(() => {
  const range = feedbackRange.value
  if (isMorning.value) {
    if (range === 'A') return '🌤️'
    if (range === 'B') return '☀️'
    return '🌈'
  } else {
    if (range === 'A') return '🌙'
    if (range === 'B') return '✨'
    return '🌟'
  }
})

const emotionOptions = [
  { key: 'Excelente', emoji: '😄', labelKey: 'emotions.excellent', defaultLabel: 'Excelente', score: 4, cssClass: 'excellent' },
  { key: 'Bien', emoji: '🙂', labelKey: 'emotions.good', defaultLabel: 'Bien', score: 3, cssClass: 'good' },
  { key: 'Normal', emoji: '😐', labelKey: 'emotions.normal', defaultLabel: 'Normal', score: 2, cssClass: 'average' },
  { key: 'Regular', emoji: '🙁', labelKey: 'emotions.poor', defaultLabel: 'Regular', score: 1, cssClass: 'poor' },
  { key: 'Muy mal', emoji: '😢', labelKey: 'emotions.bad', defaultLabel: 'Muy mal', score: 0, cssClass: 'bad' }
]

function resetSurvey() {
  step.value = 1
  q1Answer.value = ''
  q1Score.value = 0
  q2Answer.value = ''
  q2Score.value = 0
  feedbackProgress.value = 100
  currentHour.value = new Date().getHours()
  if (timeoutId) clearTimeout(timeoutId)
  if (feedbackTimeoutId) clearTimeout(feedbackTimeoutId)
  if (feedbackIntervalId) clearInterval(feedbackIntervalId)
}

watch(() => props.isActive, (newVal) => {
  if (newVal) {
    window.dispatchEvent(new Event('user-activity'))
    window.dispatchEvent(new CustomEvent('dismiss-all-notifications'))
    resetSurvey()
    startQuestionTimeout()
  } else {
    resetSurvey()
  }
})

onMounted(() => {
  if (props.isActive) {
    window.dispatchEvent(new Event('user-activity'))
    window.dispatchEvent(new CustomEvent('dismiss-all-notifications'))
    resetSurvey()
    startQuestionTimeout()
  }
})

onUnmounted(() => {
  resetSurvey()
})

function startQuestionTimeout() {
  if (timeoutId) clearTimeout(timeoutId)
  timeoutId = setTimeout(() => {
    emit('missed')
  }, timeoutSeconds * 1000)
}

function handleSelectAnswer(option: { key: string; score: number }) {
  window.dispatchEvent(new Event('user-activity'))
  
  if (step.value === 1) {
    q1Answer.value = option.key
    q1Score.value = option.score
    step.value = 2
    startQuestionTimeout()
  } else if (step.value === 2) {
    q2Answer.value = option.key
    q2Score.value = option.score
    step.value = 3
    if (timeoutId) clearTimeout(timeoutId)
    submitSurvey()
    startFeedbackTimer()
  }
}

function handleSkipAnswer() {
  handleSelectAnswer({ key: t('emotions.not_now') || 'Ahora no, gracias', score: 0 })
}

function startFeedbackTimer() {
  if (feedbackTimeoutId) clearTimeout(feedbackTimeoutId)
  if (feedbackIntervalId) clearInterval(feedbackIntervalId)
  
  feedbackProgress.value = 100
  const startTime = Date.now()
  const totalMs = feedbackSeconds * 1000

  feedbackIntervalId = setInterval(() => {
    const elapsed = Date.now() - startTime
    const remainingRatio = Math.max(0, 1 - (elapsed / totalMs))
    feedbackProgress.value = remainingRatio * 100
  }, 100)

  feedbackTimeoutId = setTimeout(() => {
    finishFeedback()
  }, totalMs)
}

function closeOverlay() {
  if (timeoutId) clearTimeout(timeoutId)
  if (feedbackTimeoutId) clearTimeout(feedbackTimeoutId)
  if (feedbackIntervalId) clearInterval(feedbackIntervalId)
  emit('missed')
}

function finishFeedback() {
  if (feedbackTimeoutId) clearTimeout(feedbackTimeoutId)
  if (feedbackIntervalId) clearInterval(feedbackIntervalId)
  emit('answered', totalScore.value)
}

function handleRequestCall() {
  if (feedbackTimeoutId) clearTimeout(feedbackTimeoutId)
  if (feedbackIntervalId) clearInterval(feedbackIntervalId)
  emit('request-call')
  emit('answered', totalScore.value)
}

async function submitSurvey() {
  let mappedEmotion = 'Normal'
  const score = totalScore.value
  if (score <= 1) mappedEmotion = 'Muy mal'
  else if (score <= 3) mappedEmotion = 'Regular'
  else if (score <= 5) mappedEmotion = 'Normal'
  else if (score <= 7) mappedEmotion = 'Bien'
  else mappedEmotion = 'Excelente'

  const periodName = isMorning.value ? 'morning' : 'night'
  const q1Text = isMorning.value ? t('emotions.morning_q1') : t('emotions.night_q1')
  const q2Text = isMorning.value ? t('emotions.morning_q2') : t('emotions.night_q2')

  const payload = {
    emotion: mappedEmotion,
    period: periodName,
    q1_question: q1Text,
    q1_answer: q1Answer.value,
    q1_score: q1Score.value,
    q2_question: q2Text,
    q2_answer: q2Answer.value,
    q2_score: q2Score.value,
    total_score: score,
    feedback_range: feedbackRange.value,
    feedback_text: feedbackMessage.value,
    statements: [
      `P1: ${q1Answer.value} (${q1Score.value} pts)`,
      `P2: ${q2Answer.value} (${q2Score.value} pts)`,
      `Puntuación: ${score}/8 pts (Rango ${feedbackRange.value})`
    ],
    timestamp: new Date().toISOString()
  }

  try {
    if ((window as any).config && (window as any).config.submitEmotion) {
      await (window as any).config.submitEmotion(payload)
    }
  } catch (e) {
    console.error('Failed to submit emotion survey', e)
  }
}
</script>

<template>
  <Teleport defer to="body">
    <div 
      class="emotion-overlay" 
      :class="[isMorning ? 'theme-morning' : 'theme-night', { active: isActive }]"
    >
      <div 
        class="emotion-card glass-panel" 
        :class="[isMorning ? 'card-morning' : 'card-night', { active: isActive }]"
      >
        <!-- Top Close Button -->
        <button class="close-overlay-btn" @click="closeOverlay" aria-label="Cerrar">
          <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <!-- Dynamic Transition between Steps (Slide + Fade) -->
        <Transition name="step-slide" mode="out-in">
          <!-- STEP 1: PREGUNTA 1 -->
          <div v-if="step === 1" key="step-1" class="step-container">
            <div class="header-meta">
              <span class="period-badge">
                <span class="badge-icon">{{ isMorning ? '🌅' : '🌆' }}</span>
                <span>{{ isMorning ? 'Mañana' : 'Noche' }}</span>
              </span>
              <span class="step-pill">
                {{ t('emotions.step_indicator', { step: 1 }) || 'Pregunta 1 de 2' }}
              </span>
            </div>

            <h1 class="emotion-title">
              {{ isMorning ? (t('emotions.morning_q1') || 'Buenos días, ¿qué tal has dormido esta noche?') : (t('emotions.night_q1') || 'Buenas noches, cuéntame, ¿qué tal ha ido el día?') }}
            </h1>
            <p class="emotion-subtitle">{{ t('emotions.select_option') || 'Por favor, selecciona una opción:' }}</p>

            <div class="emotion-buttons">
              <button 
                v-for="opt in emotionOptions"
                :key="opt.key"
                class="emotion-btn" 
                :class="opt.cssClass" 
                @click="handleSelectAnswer(opt)"
              >
                <span class="emoji">{{ opt.emoji }}</span>
                <span class="label">{{ t(opt.labelKey) || opt.defaultLabel }}</span>
              </button>
            </div>

            <div class="skip-container">
              <button class="skip-btn" @click="handleSkipAnswer">
                <span class="skip-icon">⏭️</span>
                <span>{{ t('emotions.not_now') || 'Ahora no, gracias' }}</span>
              </button>
            </div>
          </div>

          <!-- STEP 2: PREGUNTA 2 -->
          <div v-else-if="step === 2" key="step-2" class="step-container">
            <div class="header-meta">
              <span class="period-badge">
                <span class="badge-icon">{{ isMorning ? '🌅' : '🌆' }}</span>
                <span>{{ isMorning ? 'Mañana' : 'Noche' }}</span>
              </span>
              <span class="step-pill">
                {{ t('emotions.step_indicator', { step: 2 }) || 'Pregunta 2 de 2' }}
              </span>
            </div>

            <h1 class="emotion-title">
              {{ isMorning ? (t('emotions.morning_q2') || '¿Cómo estás de energía y ánimos para afrontar el día?') : (t('emotions.night_q2') || 'Y sobre sentirnos acompañados, ¿cómo te has sentido en el día de hoy?') }}
            </h1>
            <p class="emotion-subtitle">{{ t('emotions.select_option') || 'Por favor, selecciona una opción:' }}</p>

            <div class="emotion-buttons">
              <button 
                v-for="opt in emotionOptions"
                :key="opt.key"
                class="emotion-btn" 
                :class="opt.cssClass" 
                @click="handleSelectAnswer(opt)"
              >
                <span class="emoji">{{ opt.emoji }}</span>
                <span class="label">{{ t(opt.labelKey) || opt.defaultLabel }}</span>
              </button>
            </div>

            <div class="skip-container">
              <button class="skip-btn" @click="handleSkipAnswer">
                <span class="skip-icon">⏭️</span>
                <span>{{ t('emotions.not_now') || 'Ahora no, gracias' }}</span>
              </button>
            </div>
          </div>

          <!-- STEP 3: FEED-BACK SCREEN (30s DURATION) -->
          <div v-else-if="step === 3" key="step-3" class="step-container feedback-container">
            <div class="feedback-icon-wrapper">
              <span class="feedback-icon">{{ feedbackIcon }}</span>
            </div>

            <div class="feedback-badge-row">
              <span class="range-badge" :class="`range-${feedbackRange.toLowerCase()}`">
                Rango {{ feedbackRange }} · {{ totalScore }}/8 pts
              </span>
            </div>

            <p class="feedback-text">{{ feedbackMessage }}</p>

            <div class="feedback-actions">
              <button 
                v-if="isMorning" 
                class="action-btn call-btn" 
                @click="handleRequestCall"
              >
                <span class="btn-icon">📞</span>
                <span>{{ t('emotions.request_call') || 'Solicitar una llamada' }}</span>
              </button>

              <button class="action-btn finish-btn" @click="finishFeedback">
                <span>{{ t('emotions.understood_btn') || 'Entendido' }}</span>
              </button>
            </div>

            <!-- Auto-dismiss countdown bar (30 seconds) -->
            <div class="feedback-timer-bar">
              <div class="timer-fill" :style="{ width: `${feedbackProgress}%` }"></div>
            </div>
          </div>
        </Transition>
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
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(14px);
  pointer-events: all;
}

/* Base Card */
.emotion-card {
  position: relative;
  width: 1040px;
  max-width: 95vw;
  border-radius: 40px;
  padding: 3rem 2.5rem;
  box-shadow: 0 40px 100px rgba(0,0,0,0.6);
  transform: translateY(50px) scale(0.92);
  opacity: 0;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
}

.emotion-card.active {
  transform: translateY(0) scale(1);
  opacity: 1;
}

/* 🌅 MAÑANA: Fondo Amanecer fotográfico integrado con cristal glaseado */
.card-morning {
  background: 
    linear-gradient(180deg, rgba(255, 251, 240, 0.86) 0%, rgba(254, 243, 199, 0.90) 100%),
    url('/images/sunrise_modal_bg.jpg') center/cover no-repeat;
  border: 3px solid rgba(251, 191, 36, 0.65);
  box-shadow: 0 35px 90px rgba(217, 119, 6, 0.3), 0 0 50px rgba(253, 230, 138, 0.55);
  color: #0f172a;
  backdrop-filter: blur(16px);
}

.card-morning .emotion-title {
  color: #0f172a;
}

.card-morning .emotion-subtitle {
  color: #334155;
  font-weight: 600;
}

/* 🌆 NOCHE: Fondo Atardecer/Crepúsculo integrado con cristal oscuro */
.card-night {
  background: 
    linear-gradient(180deg, rgba(15, 23, 42, 0.80) 0%, rgba(30, 27, 75, 0.85) 100%),
    url('/images/sunset_modal_bg.jpg') center/cover no-repeat;
  border: 3px solid rgba(129, 140, 248, 0.45);
  box-shadow: 0 35px 90px rgba(15, 23, 42, 0.8), 0 0 50px rgba(99, 102, 241, 0.3);
  color: #f8fafc;
  backdrop-filter: blur(16px);
}

.card-night .emotion-title {
  color: #ffffff;
}

.card-night .emotion-subtitle {
  color: #cbd5e1;
}

/* Close Button */
.close-overlay-btn {
  position: absolute;
  top: 1.6rem;
  right: 1.6rem;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: rgba(148, 163, 184, 0.3);
  color: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 20;
  backdrop-filter: blur(8px);
}

.close-overlay-btn:hover {
  background: rgba(148, 163, 184, 0.5);
  transform: scale(1.08);
}

.close-overlay-btn:active {
  transform: scale(0.95);
}

/* Step Container & Transitions */
.step-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.35rem;
  will-change: transform, opacity;
}

/* Slide + Fade Animation */
.step-slide-enter-active {
  transition: opacity 0.34s cubic-bezier(0.16, 1, 0.3, 1), transform 0.34s cubic-bezier(0.16, 1, 0.3, 1);
}

.step-slide-leave-active {
  transition: opacity 0.22s cubic-bezier(0.7, 0, 0.84, 0), transform 0.22s cubic-bezier(0.7, 0, 0.84, 0);
}

.step-slide-enter-from {
  opacity: 0;
  transform: translateX(45px) scale(0.98);
}

.step-slide-leave-to {
  opacity: 0;
  transform: translateX(-45px) scale(0.98);
}

/* Header Meta */
.header-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.period-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.4rem 1.1rem;
  border-radius: 30px;
  backdrop-filter: blur(8px);
}

.card-morning .period-badge {
  background: rgba(254, 240, 138, 0.9);
  color: #854d0e;
  border: 1.5px solid #facc15;
}

.card-night .period-badge {
  background: rgba(49, 46, 129, 0.85);
  color: #c7d2fe;
  border: 1.5px solid #6366f1;
}

.step-pill {
  font-size: 1.15rem;
  font-weight: 700;
  padding: 0.4rem 1.2rem;
  border-radius: 30px;
  background: rgba(100, 116, 139, 0.25);
  color: inherit;
  backdrop-filter: blur(8px);
}

/* Titles */
.emotion-title {
  font-size: 2.75rem;
  font-weight: 850;
  margin: 0;
  text-align: center;
  line-height: 1.25;
  max-width: 90%;
  text-shadow: 0 2px 10px rgba(0,0,0,0.15);
}

.card-night .emotion-title {
  text-shadow: 0 2px 14px rgba(0,0,0,0.6);
}

.emotion-subtitle {
  font-size: 1.5rem;
  margin: 0;
  text-align: center;
}

/* 5 Emotion Buttons */
.emotion-buttons {
  display: flex;
  gap: 1.1rem;
  width: 100%;
  justify-content: center;
  margin-top: 0.4rem;
}

.emotion-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  height: 190px;
  border-radius: 26px;
  border: 4px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 10px 25px rgba(0,0,0,0.15);
  backdrop-filter: blur(10px);
}

.card-morning .emotion-btn {
  background: rgba(255, 255, 255, 0.88);
}

.card-night .emotion-btn {
  background: rgba(23, 23, 45, 0.82);
}

.emotion-btn:active {
  transform: scale(0.95);
}

.emotion-btn .emoji {
  font-size: 4.4rem;
  transition: transform 0.2s ease;
}

.emotion-btn:hover .emoji {
  transform: scale(1.15);
}

.emotion-btn .label {
  font-size: 1.35rem;
  font-weight: 800;
  text-align: center;
  word-break: break-word;
}

.card-morning .emotion-btn .label {
  color: #1e293b;
}

.card-night .emotion-btn .label {
  color: #f8fafc;
}

/* Emotion Color Accents */
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

.card-morning .emotion-btn.excellent:hover {
  background: rgba(220, 252, 231, 0.95);
}
.card-morning .emotion-btn.good:hover {
  background: rgba(236, 252, 203, 0.95);
}
.card-morning .emotion-btn.average:hover {
  background: rgba(254, 240, 138, 0.95);
}
.card-morning .emotion-btn.poor:hover {
  background: rgba(255, 237, 213, 0.95);
}
.card-morning .emotion-btn.bad:hover {
  background: rgba(254, 226, 226, 0.95);
}

.card-night .emotion-btn.excellent:hover {
  background: rgba(22, 163, 74, 0.35);
}
.card-night .emotion-btn.good:hover {
  background: rgba(101, 163, 13, 0.35);
}
.card-night .emotion-btn.average:hover {
  background: rgba(202, 138, 4, 0.35);
}
.card-night .emotion-btn.poor:hover {
  background: rgba(234, 88, 12, 0.35);
}
.card-night .emotion-btn.bad:hover {
  background: rgba(220, 38, 38, 0.35);
}

/* Skip / "Ahora no, gracias" button */
.skip-container {
  display: flex;
  justify-content: center;
  width: 100%;
  margin-top: 0.4rem;
}

.skip-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 2.2rem;
  border-radius: 40px;
  font-size: 1.4rem;
  font-weight: 750;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px dashed rgba(148, 163, 184, 0.6);
  background: rgba(255, 255, 255, 0.2);
  color: inherit;
  backdrop-filter: blur(8px);
}

.skip-btn:hover {
  background: rgba(148, 163, 184, 0.3);
  transform: scale(1.03);
}

.skip-btn:active {
  transform: scale(0.96);
}

.skip-icon {
  font-size: 1.35rem;
}

/* STEP 3: FEEDBACK CONTAINER */
.feedback-container {
  padding: 1rem 0;
  text-align: center;
  gap: 1.6rem;
}

.feedback-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

.feedback-icon {
  font-size: 6.5rem;
  line-height: 1;
  animation: bounceSoft 2s infinite ease-in-out;
}

@keyframes bounceSoft {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.feedback-badge-row {
  display: flex;
  justify-content: center;
}

.range-badge {
  font-size: 1.15rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.45rem 1.4rem;
  border-radius: 30px;
  backdrop-filter: blur(8px);
}

.card-morning .range-badge {
  background: rgba(254, 215, 170, 0.92);
  color: #9a3412;
}

.card-night .range-badge {
  background: rgba(55, 48, 163, 0.9);
  color: #e0e7ff;
}

.feedback-text {
  font-size: 2.25rem;
  font-weight: 800;
  line-height: 1.4;
  margin: 0;
  max-width: 92%;
  text-shadow: 0 2px 10px rgba(0,0,0,0.15);
}

.card-morning .feedback-text {
  color: #0f172a;
}

.card-night .feedback-text {
  color: #ffffff;
  text-shadow: 0 2px 14px rgba(0,0,0,0.7);
}

.feedback-actions {
  display: flex;
  gap: 1.5rem;
  margin-top: 0.6rem;
  justify-content: center;
  flex-wrap: wrap;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.85rem;
  padding: 1.2rem 2.8rem;
  border-radius: 50px;
  font-size: 1.65rem;
  font-weight: 800;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
}

.action-btn:active {
  transform: scale(0.96);
}

.call-btn {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
}

.call-btn:hover {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: scale(1.05);
  box-shadow: 0 15px 35px rgba(16, 185, 129, 0.4);
}

.finish-btn {
  background: #2563eb;
  color: #ffffff;
}

.finish-btn:hover {
  background: #1d4ed8;
  transform: scale(1.05);
  box-shadow: 0 15px 35px rgba(37, 99, 235, 0.4);
}

/* Countdown bar (30s) */
.feedback-timer-bar {
  width: 360px;
  max-width: 80%;
  height: 6px;
  background: rgba(148, 163, 184, 0.35);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 0.5rem;
}

.timer-fill {
  height: 100%;
  transition: width 0.1s linear;
}

.card-morning .timer-fill {
  background: #d97706;
}

.card-night .timer-fill {
  background: #818cf8;
}
</style>
