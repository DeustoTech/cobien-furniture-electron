import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const _dirname = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))

export function listenWithVosk(
  language: string = 'es',
  onLevel?: (level: number) => void
): Promise<string | null> {
  const bridgePath = join(_dirname, '../../../cobien_FrontEnd/app/asr_bridge.py')
  const modelPath = language === 'es' 
    ? join(_dirname, '../../../cobien_FrontEnd/app/virtual_assistant/vosk_models/vosk-model-small-es-0.42')
    : join(_dirname, '../../../cobien_FrontEnd/app/virtual_assistant/vosk_models/vosk-model-small-fr-0.22')

  return new Promise((resolve) => {
    const pythonBin = join(_dirname, '../../../cobien_FrontEnd/app/.venv/bin/python3')
    const python = spawn(pythonBin, [bridgePath, modelPath])

    let result = ''
    python.stdout.on('data', (data) => {
      const chunk = data.toString()
      result += chunk
      
      // Look for level updates in the stream
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (line.includes('"level":')) {
          try {
            const parsed = JSON.parse(line.trim())
            if (typeof parsed.level === 'number' && onLevel) {
              onLevel(parsed.level)
            }
          } catch(e) {}
        }
      }
    })

    python.stderr.on('data', (data) => {
      console.error(`ASR Bridge Error: ${data}`)
    })

    python.on('close', (code) => {
      try {
        const lines = result.trim().split('\n')
        let lastJson = ''
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim()
          if (line.startsWith('{') && line.endsWith('}') && line.includes('"text":')) {
            lastJson = line
            break
          }
        }
        
        if (!lastJson) {
          console.error('ASR Bridge: No text JSON found in output', result)
          resolve(null)
          return
        }

        const parsed = JSON.parse(lastJson)
        resolve(parsed.text || null)
      } catch (e) {
        console.error('ASR Bridge parse error:', e, result)
        resolve(null)
      }
    })

  })
}

