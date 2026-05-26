import { createModel } from 'vosk-browser'

// Global states
const loadedModels: Record<string, any> = {}
let currentModel: any = null
let currentRecognizer: any = null
let isListening = false
let isWakeWordMode = false

let mediaStream: MediaStream | null = null
let audioContext: AudioContext | null = null
let source: MediaStreamAudioSourceNode | null = null
let processor: ScriptProcessorNode | null = null

// Levenshtein distance helper functions for fuzzy matching
function editDistance(s1: string, s2: string): number {
  const costs: number[] = []
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j
      } else {
        if (j > 0) {
          let newValue = costs[j - 1]
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
          }
          costs[j - 1] = lastValue
          lastValue = newValue
        }
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue
    }
  }
  return costs[s2.length]
}

function getSimilarity(s1: string, s2: string): number {
  let longer = s1
  let shorter = s2
  if (s1.length < s2.length) {
    longer = s2
    shorter = s1
  }
  const longerLength = longer.length
  if (longerLength === 0) return 1.0
  return (longerLength - editDistance(longer, shorter)) / longerLength
}

// Fuzzy matching helpers
function fuzzyMatch(text: string, target: string, threshold = 0.8): boolean {
  text = text.toLowerCase().trim()
  target = target.toLowerCase().trim()
  if (text.includes(target)) return true
  const compactText = text.replace(/\s+/g, '')
  if (compactText.includes(target)) return true
  
  const ratio = getSimilarity(compactText, target)
  return ratio >= threshold
}

function isCobien(text: string): boolean {
  text = text.toLowerCase().trim()
  const variations = [
    "cobien", "como bien", "cómo bien", "con bien", "convien", "comien",
    "cobian", "cobién", "co bien", "convian", "combien"
  ]
  return variations.some(v => text.includes(v))
}

export async function initModel(lang: string = 'es'): Promise<any> {
  const normalizedLang = lang.split('-')[0].toLowerCase() // e.g., 'es-ES' -> 'es'
  
  if (loadedModels[normalizedLang]) {
    currentModel = loadedModels[normalizedLang]
    return currentModel
  }

  const modelUrl = normalizedLang === 'fr' 
    ? './models/vosk/vosk-model-small-fr-0.22.tar.gz' 
    : normalizedLang === 'en'
    ? './models/vosk/vosk-model-small-en-us-0.15.tar.gz'
    : './models/vosk/vosk-model-small-es-0.42.tar.gz'

  console.log(`[ASR] Loading model for ${normalizedLang} from ${modelUrl}...`)
  
  try {
    const model = await createModel(modelUrl)
    loadedModels[normalizedLang] = model
    currentModel = model
    console.log(`[ASR] Model for ${normalizedLang} loaded successfully`)
    return model
  } catch (error) {
    console.error(`[ASR] Error loading model for ${normalizedLang}:`, error)
    throw error
  }
}

export async function startListening(
  lang: string = 'es',
  onResult: (text: string) => void,
  onPartial: (text: string) => void,
  onLevel: (level: number) => void
): Promise<void> {
  if (isListening) {
    stopListening()
  }

  console.log(`[ASR] Starting listening session (lang: ${lang})...`)

  // Ensure model is loaded
  const model = await initModel(lang)
  
  // Setup recognizer
  const recognizer = new model.KaldiRecognizer(16000)
  currentRecognizer = recognizer

  recognizer.on('result', (message: any) => {
    const text = message.result?.text || ''
    if (text) {
      console.log(`[ASR] Final result: ${text}`)
      onResult(text)
    }
  })

  recognizer.on('partialresult', (message: any) => {
    const partial = message.result?.partial || ''
    if (partial) {
      onPartial(partial)
    }
  })

  // Start microphone capture (16000Hz, Mono like Vosk requires)
  mediaStream = await navigator.mediaDevices.getUserMedia({
    video: false,
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
      sampleRate: 16000
    }
  })

  audioContext = new AudioContext({ sampleRate: 16000 })
  source = audioContext.createMediaStreamSource(mediaStream)
  processor = audioContext.createScriptProcessor(4096, 1, 1)

  processor.onaudioprocess = (event) => {
    if (!isListening) return

    const inputBuffer = event.inputBuffer
    
    // Calculate volume level (RMS)
    const channelData = inputBuffer.getChannelData(0)
    let sum = 0
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i]
    }
    const rms = Math.sqrt(sum / channelData.length)
    const normalizedLevel = Math.min(1.0, rms / 0.15) // Empiric scale for feedback visual
    onLevel(normalizedLevel)

    try {
      recognizer.acceptWaveform(inputBuffer)
    } catch (e) {
      console.error('[ASR] Error passing audio buffer:', e)
    }
  }

  source.connect(processor)
  processor.connect(audioContext.destination)
  isListening = true
}

export function stopListening(): void {
  if (!isListening) return
  console.log('[ASR] Stopping listening session...')
  isListening = false

  if (processor) {
    processor.disconnect()
    processor = null
  }
  if (source) {
    source.disconnect()
    source = null
  }
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop())
    mediaStream = null
  }
  if (currentRecognizer) {
    currentRecognizer.destroy()
    currentRecognizer = null
  }
}

export async function startWakeWordDetection(
  lang: string = 'es',
  onDetected: () => void
): Promise<void> {
  if (isWakeWordMode) {
    stopWakeWordDetection()
  }

  console.log(`[WAKE] Starting background Wake Word detection (lang: ${lang})...`)

  const model = await initModel(lang)
  const recognizer = new model.KaldiRecognizer(16000)
  currentRecognizer = recognizer

  const wakeWord = 'cobien'

  recognizer.on('result', (message: any) => {
    const text = message.result?.text || ''
    if (text) {
      console.log(`[WAKE] Recognized text (final): "${text}"`)
      if (text.includes(wakeWord) || isCobien(text) || fuzzyMatch(text, wakeWord)) {
        console.log('[WAKE] Keyword detected in final result!')
        onDetected()
      }
    }
  })

  recognizer.on('partialresult', (message: any) => {
    const partial = message.result?.partial || ''
    if (partial) {
      console.log(`[WAKE] Recognized partial: "${partial}"`)
      // Partial check requires length guard to avoid false triggers
      if (partial.length >= 5 && (partial.includes(wakeWord) || isCobien(partial) || fuzzyMatch(partial, wakeWord, 0.85))) {
        console.log('[WAKE] Keyword detected in partial result!')
        onDetected()
      }
    }
  })

  mediaStream = await navigator.mediaDevices.getUserMedia({
    video: false,
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
      sampleRate: 16000
    }
  })

  audioContext = new AudioContext({ sampleRate: 16000 })
  source = audioContext.createMediaStreamSource(mediaStream)
  processor = audioContext.createScriptProcessor(4096, 1, 1)

  processor.onaudioprocess = (event) => {
    if (!isWakeWordMode) return
    try {
      recognizer.acceptWaveform(event.inputBuffer)
    } catch (e) {
      console.error('[WAKE] Error processing audio buffer:', e)
    }
  }

  source.connect(processor)
  processor.connect(audioContext.destination)
  isWakeWordMode = true
}

export function stopWakeWordDetection(): void {
  if (!isWakeWordMode) return
  console.log('[WAKE] Stopping Wake Word detection...')
  isWakeWordMode = false

  if (processor) {
    processor.disconnect()
    processor = null
  }
  if (source) {
    source.disconnect()
    source = null
  }
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop())
    mediaStream = null
  }
  if (currentRecognizer) {
    currentRecognizer.destroy()
    currentRecognizer = null
  }
}
