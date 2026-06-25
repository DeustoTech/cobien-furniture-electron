let activeAudioCtx: AudioContext | null = null
let activeSource: AudioBufferSourceNode | null = null

export async function stopTtsAudio() {
  if (activeSource) {
    try {
      activeSource.stop()
    } catch (e) {
      // Ignore if already stopped or not started
    }
    activeSource = null
  }
  if (activeAudioCtx) {
    try {
      await activeAudioCtx.close()
    } catch (e) {
      // Ignore
    }
    activeAudioCtx = null
  }
  if ((window as any).config && typeof (window as any).config.ttsStop === 'function') {
    try {
      await (window as any).config.ttsStop()
    } catch (e) {
      // Ignore
    }
  }
}

export async function playTtsAudio(buffer: any): Promise<void> {
  // 1. Stop any currently playing audio
  await stopTtsAudio()

  if (!buffer) return

  // 2. Create new AudioContext
  const audioCtx = new AudioContext()
  activeAudioCtx = audioCtx
  await audioCtx.resume()

  // 3. Decode buffer
  // Handle both raw ArrayBuffer and Node-like Buffer/Uint8Array
  const arrayBuffer = buffer.buffer
    ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    : buffer

  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer)
    
    // Check if we were cancelled during decoding
    if (activeAudioCtx !== audioCtx) {
      return
    }

    const source = audioCtx.createBufferSource()
    source.buffer = decoded
    source.connect(audioCtx.destination)
    activeSource = source

    return new Promise<void>((resolve) => {
      source.onended = () => {
        if (activeSource === source) {
          activeSource = null
        }
        resolve()
      }
      source.start()
    })
  } catch (e) {
    console.error('Error decoding/playing audio data:', e)
  }
}
