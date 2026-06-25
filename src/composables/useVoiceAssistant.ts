import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSettings } from './useSettings'
import { startListening, stopListening, startWakeWordDetection, stopWakeWordDetection } from '../services/voiceRecognizer'
import { playTtsAudio, stopTtsAudio } from '../services/audioPlayer'
const lastGreetingIndex = ref(-1)

export function useVoiceAssistant() {
  const router = useRouter()
  const { locale, t, tm } = useI18n()
  const { ttsEngine, voiceGenders } = useSettings()


  
  const isActive = ref(false)
  const message = ref('')
  const audioLevel = ref(0)
  const step = ref<'idle' | 'listening' | 'speaking'>('idle')





  async function speak(text: string) {
    step.value = 'speaking'
    // message.value = text // Removed as per user request to only show user speech
    try {
      const lang = locale.value as string
      const engine = ttsEngine.value
      const gender = voiceGenders.value[lang] || 'male'
      const buffer = await (window as any).config.ttsSpeak(text, lang, gender, engine)


      if (buffer) {
        await playTtsAudio(buffer)
      } else {
        await new Promise(r => setTimeout(r, 1500))
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 1500))
    }
  }

  async function listen(): Promise<string | null> {
    step.value = 'listening'
    message.value = '🎤 ...'
    
    return new Promise((resolve) => {
      // Temporarily stop Wake Word while listening to user command
      stopWakeWordDetection()

      startListening(
        locale.value,
        // onResult
        (text) => {
          stopListening()
          audioLevel.value = 0
          resolve(text)
        },
        // onPartial
        (partialText) => {
          if (partialText) {
            message.value = `🎤 ${partialText}...`
          }
        },
        // onLevel
        (level) => {
          audioLevel.value = level
        }
      ).catch((err) => {
        console.error('ASR start error:', err)
        audioLevel.value = 0
        resolve(null)
      })
    })
  }


  async function startAssistant() {
    if (isActive.value) return
    isActive.value = true
    
    const g = (tm as any)('assistant.greetings')
    const greetings = Array.isArray(g) ? g : [
      t('assistant.greeting_1') || "Hello",
      t('assistant.greeting_2') || "How can I help you?"
    ]
    
    let idx = Math.floor(Math.random() * greetings.length)
    // Avoid repeating the same greeting twice in a row
    if (idx === lastGreetingIndex.value && greetings.length > 1) {
      idx = (idx + 1) % greetings.length
    }
    lastGreetingIndex.value = idx
    const randomGreeting = greetings[idx]
    
    await speak(randomGreeting)
    if (!isActive.value) return 
    
    const command = await listen()
    if (!isActive.value) return 
    
    if (!command) {
      message.value = t('assistant.not_understood')
      await speak(t('assistant.not_understood'))
      await new Promise(r => setTimeout(r, 1500))
      isActive.value = false
      step.value = 'idle'
      
      // Re-enable Wake Word detection
      try {
        startWakeWordDetection(locale.value, () => {
          console.log('[WAKE] UI Triggered by voice')
          window.dispatchEvent(new Event('wake-word-detected'))
          startAssistant()
        })
      } catch(e) {}
      return
    }

    const text = command.toLowerCase()
    message.value = t('assistant.understood', { text })
    
    const keywords = {
      weather: ['tiempo', 'clima', 'météo', 'prévisions', 'weather', 'forecast'],
      events: ['eventos', 'agenda', 'calendario', 'événements', 'calendrier', 'events', 'calendar'],
      board: ['mensajes', 'pizarra', 'tableau', 'messages', 'board'],
      call: ['llamar', 'llamada', 'appeler', 'appel', 'contact', 'call', 'phone'],
      home: ['inicio', 'volver', 'accueil', 'retour', 'home', 'back']
    }

    const stopKeywords = {
      es: ['silencio', 'cállate', 'callate', 'para', 'es suficiente', 'basta'],
      en: ['silence', 'shut up', 'stop', 'enough'],
      fr: ['silence', 'tais-toi', 'arrête', 'ça suffit']
    }
    const currentLang = (locale.value.split('-')[0] || 'es') as keyof typeof stopKeywords
    const activeStopWords = stopKeywords[currentLang] || stopKeywords.es

    if (activeStopWords.some(k => text.includes(k))) {
      await (window as any).config.ttsStop()
      isActive.value = false
      step.value = 'idle'
      
      // Re-enable Wake Word detection
      try {
        startWakeWordDetection(locale.value, () => {
          console.log('[WAKE] UI Triggered by voice')
          window.dispatchEvent(new Event('wake-word-detected'))
          startAssistant()
        })
      } catch(e) {}
      return
    }

    if (keywords.weather.some(k => text.includes(k))) {
      await speak(t('assistant.opening_weather'))
      router.push('/weather')
    } else if (keywords.events.some(k => text.includes(k))) {
      await speak(t('assistant.opening_events'))
      router.push('/events')
    } else if (keywords.board.some(k => text.includes(k))) {
      await speak(t('assistant.opening_board'))
      router.push('/board')
    } else if (keywords.call.some(k => text.includes(k))) {
      await speak(t('assistant.opening_contacts'))
      router.push('/call')
    } else if (keywords.home.some(k => text.includes(k))) {
      await speak(t('assistant.going_home'))
      router.push('/')
    } else {
      // Fallback or generic response
      await speak(t('assistant.not_understood'))
    }


    await new Promise(r => setTimeout(r, 1500))
    isActive.value = false
    step.value = 'idle'
    
    // Re-enable Wake Word detection
    try {
      startWakeWordDetection(locale.value, () => {
        console.log('[WAKE] UI Triggered by voice')
        window.dispatchEvent(new Event('wake-word-detected'))
        startAssistant()
      })
    } catch(e) {}
  }


  function cancelAssistant() {
    console.log('[ASR] Cancelling assistant flow')
    isActive.value = false
    step.value = 'idle'
    try {
      stopListening()
      stopTtsAudio()
      // Force restart wake word listening
      setTimeout(() => {
        startWakeWordDetection(locale.value, () => {
          console.log('[WAKE] UI Triggered by voice')
          window.dispatchEvent(new Event('wake-word-detected'))
          startAssistant()
        })
      }, 500)
    } catch(e) {
      console.error('Cancel error:', e)
    }
  }


  return {
    isActive,
    message,
    audioLevel,
    step,
    speak,
    startAssistant,
    cancelAssistant
  }
}

