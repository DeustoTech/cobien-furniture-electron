import { ref } from 'vue'
import { useRouter } from 'vue-router'

export function useVoiceAssistant() {
  const router = useRouter()
  const isActive = ref(false)
  const message = ref('')
  const audioLevel = ref(0)
  const step = ref<'idle' | 'listening' | 'speaking'>('idle')

  async function speak(text: string) {
    step.value = 'speaking'
    message.value = text
    try {
      const buffer = await (window as any).config.ttsSpeak(text)
      if (buffer) {
        const audioCtx = new AudioContext()
        const decoded = await audioCtx.decodeAudioData(buffer)
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
    // Subscribe to audio levels and partial results
    const stopLevel = (window as any).config.onAsrLevel((lvl: number) => {
      audioLevel.value = lvl
    })
    const stopPartial = (window as any).config.onAsrPartial((text: string) => {
      if (text) message.value = `🎤 ${text}...`
    })

    try {
      const text = await (window as any).config.sttListen('es')
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
    
    await speak('Hola, ¿en qué puedo ayudarte?')
    
    const command = await listen()
    
    if (!command) {
      message.value = 'No te he entendido. Inténtalo de nuevo.'
      await speak('No he reconocido el comando.')
      await new Promise(r => setTimeout(r, 1500))
      isActive.value = false
      step.value = 'idle'
      return
    }

    const text = command.toLowerCase()
    message.value = `Has dicho: "${text}"`
    
    if (text.includes('tiempo') || text.includes('clima') || text.includes('pronóstico')) {
      await speak('Abriendo el tiempo.')
      router.push('/weather')
    } else if (text.includes('eventos') || text.includes('agenda') || text.includes('calendario')) {
      await speak('Abriendo tu agenda.')
      router.push('/events')
    } else if (text.includes('mensajes') || text.includes('pizarra') || text.includes('mensaje')) {
      await speak('Abriendo la pizarra de mensajes.')
      router.push('/board')
    } else if (text.includes('llamar') || text.includes('llamada') || text.includes('contacto')) {
      await speak('Abriendo contactos para llamar.')
      router.push('/call')
    } else if (text.includes('inicio') || text.includes('comienzo') || text.includes('volver') || text.includes('principal')) {
      await speak('Volviendo al inicio.')
      router.push('/')
    } else if (text.includes('añadir') || text.includes('nuevo event') || text.includes('crear event')) {
      await speak('Dime el título del evento personal.')
      const title = await listen()
      if (!title) {
        await speak('No he entendido el título. Proceso cancelado.')
      } else {
        message.value = `Título: "${title}"`
        await speak(`Dime la descripción para el evento: ${title}.`)
        const description = await listen()
        const descFinal = description || 'Sin descripción'
        
        message.value = `Guardando: "${title}" - ${descFinal}`
        await speak('Guardando evento para hoy.')
        const today = new Date()
        const day = today.getDate().toString().padStart(2, '0')
        const month = (today.getMonth() + 1).toString().padStart(2, '0')
        const dateStr = `${day}-${month}-${today.getFullYear()}`
        
        try {
          const ok = await (window as any).config.addPersonalEvent({
            date: dateStr,
            title: title.trim(),
            description: descFinal.trim()
          })
          if (ok) {
            message.value = '🎉 Evento guardado'
            await speak('Evento añadido correctamente.')
          } else {
            await speak('Ha ocurrido un error al guardar el evento.')
          }
        } catch(e) {
          await speak('Error de conexión con la base de datos.')
        }
      }
    }
 else {
      await speak('Lo siento, no sé cómo ayudarte con eso.')
    }


    await new Promise(r => setTimeout(r, 1500))
    isActive.value = false
    step.value = 'idle'
  }

  return {
    isActive,
    message,
    audioLevel,
    step,
    startAssistant
  }
}

}
