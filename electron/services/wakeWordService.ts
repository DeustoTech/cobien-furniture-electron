import { spawn, ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'

let wakeWordProcess: ChildProcess | null = null
let isListening = false

export function startWakeWordDetection(mainWindow: BrowserWindow, _dirname: string) {
  if (isListening) return
  isListening = true

  const pythonBin = join(_dirname, '../../../cobien_FrontEnd/app/.venv/bin/python3')
  const bridgePath = join(_dirname, '../public/python/asr_bridge.py')
  const modelPath = join(_dirname, '../../../cobien_FrontEnd/app/virtual_assistant/vosk_models/vosk-model-small-es-0.42')

  console.log(`[WAKE] Starting detection for "cobien"...`)
  
  wakeWordProcess = spawn(pythonBin, [bridgePath, modelPath, '--wake-word', 'cobien'])

  wakeWordProcess.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n')
    for (const line of lines) {
      if (line.includes('"wake_word_detected":')) {
        console.log('[WAKE] Keyword detected!')
        mainWindow.webContents.send('asr:wake-word-detected')
        // We stop listening to free the mic for full ASR
        stopWakeWordDetection()
        break
      }
    }
  })

  wakeWordProcess.stderr?.on('data', (data) => {
    console.error(`[WAKE] Bridge Error: ${data}`)
  })

  wakeWordProcess.on('close', (code) => {
    console.log(`[WAKE] Bridge closed with code ${code}`)
    isListening = false
    wakeWordProcess = null
  })
}


export function stopWakeWordDetection() {
  if (wakeWordProcess) {
    wakeWordProcess.kill()
    wakeWordProcess = null
  }
  isListening = false
}
