import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSettings } from './useSettings'




export function useVoiceAssistant() {
  const router = useRouter()
  const { locale, t } = useI18n()
  const { voiceGenders } = useSettings()

  
  const isActive = ref(false)
  const message = ref('')
  const audioLevel = ref(0)
  const step = ref<'idle' | 'listening' | 'speaking'>('idle')





  async function speak(text: string) {
    step.value = 'speaking'
    message.value = text
    try {
      const lang = locale.value
      const gender = voiceGenders.value[lang] || 'male'
      const buffer = await (window as any).config.ttsSpeak(text, lang, gender)

      if (buffer) {
        const audioCtx = new AudioContext()
        await audioCtx.resume()

        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        const decoded = await audioCtx.decodeAudioData(arrayBuffer)
        const source = audioCtx.createBufferSource()

        source.buffer = decoded
        source.connect(audioCtx.destination)
        await new Promise<void>(resolve => {
          source.onended = () => resolve()
          source.start()
        })

      } else {
        await new Promise(r => setTimeout(r, 1500))
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 1500))
    }
  }

  async function listen(): Promise<string | null> {
    step.value = 'listening'
    const stopLevel = (window as any).config.onAsrLevel((lvl: number) => {
      audioLevel.value = lvl
    })
    const stopPartial = (window as any).config.onAsrPartial((text: string) => {
      if (text) message.value = `🎤 ${text}...`
    })

    try {
      const text = await (window as any).config.sttListen(locale.value)
      stopLevel()
      stopPartial()
      audioLevel.value = 0
      return text || null
    } catch (e) {
      stopLevel()
      stopPartial()
      audioLevel.value = 0
      console.error('Global STT Error:', e)
      return null
    }
  }


  async function startAssistant() {
    if (isActive.value) return
    isActive.value = true
    
    const greetings = (t('assistant.greetings', { returnObjects: true }) as string[]) || [
      "Hola, ¿en qué puedo ayudarte?",
      "Dime, ¿qué necesitas?"
    ]
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)]
    
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
      return
    }

    const text = command.toLowerCase()
    message.value = t('assistant.understood', { text })
    
    const keywords = {
      weather: ['tiempo', 'clima', 'météo', 'prévisions'],
      events: ['eventos', 'agenda', 'calendario', 'événements', 'calendrier'],
      board: ['mensajes', 'pizarra', 'tableau', 'messages'],
      call: ['llamar', 'llamada', 'appeler', 'appel', 'contact'],
      home: ['inicio', 'volver', 'accueil', 'retour']
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
    
    try {
      await (window as any).config.restartWakeWord()
    } catch(e) {}
  }


  function cancelAssistant() {
    console.log('[ASR] Cancelling assistant flow')
    isActive.value = false
    step.value = 'idle'
    try {
      (window as any).config.abortStt()
      // Force restart wake word listening
      setTimeout(() => {
        (window as any).config.restartWakeWord()
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
    startAssistant,
    cancelAssistant
  }
}

