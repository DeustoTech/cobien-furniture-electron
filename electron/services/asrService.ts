import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const _dirname = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))

export function listenWithVosk(language: string = 'es'): Promise<string | null> {
  const bridgePath = join(_dirname, '../../../cobien_FrontEnd/app/asr_bridge.py')
  const modelPath = language === 'es' 
    ? join(_dirname, '../../../cobien_FrontEnd/app/virtual_assistant/vosk_models/vosk-model-small-es-0.42')
    : join(_dirname, '../../../cobien_FrontEnd/app/virtual_assistant/vosk_models/vosk-model-small-fr-0.22')

  return new Promise((resolve) => {
    const pythonBin = join(_dirname, '../../../cobien_FrontEnd/app/.venv/bin/python3')
    const python = spawn(pythonBin, [bridgePath, modelPath])

    
    let result = ''
    python.stdout.on('data', (data) => {
      result += data.toString()
    })

    python.stderr.on('data', (data) => {
      console.error(`ASR Bridge Error: ${data}`)
    })

    python.on('close', (code) => {
      try {
        const parsed = JSON.parse(result.trim())
        resolve(parsed.text || null)
      } catch (e) {
        console.error('ASR Bridge parse error:', e, result)
        resolve(null)
      }
    })
  })
}
