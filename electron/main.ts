import { app, BrowserWindow, ipcMain } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as fsSync from 'node:fs'

const _dirname = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function getPiperConfig() {
  try {
    const configPath = join(_dirname, '../../../cobien_FrontEnd/app/config/config.default.json')
    const localPath = join(_dirname, '../../../cobien_FrontEnd/app/config/config.local.json')
    
    const defaultData = JSON.parse(fsSync.readFileSync(configPath, 'utf-8'))
    let localData = {}
    try {
      localData = JSON.parse(fsSync.readFileSync(localPath, 'utf-8'))
    } catch(e) {}
    
    // Merge services config
    const services = { ...defaultData.services, ...localData.services }
    
    // Fallback to internal piper and models if not configured or missing in system
    const internalBin = join(_dirname, '../public/models/piper/bin/piper')
    const internalModel = join(_dirname, '../public/models/piper/es_ES-davefx-medium.onnx')

    const bin = services.tts_piper_bin || internalBin
    const model = services.tts_piper_model_es_male || services.tts_piper_model_es || internalModel
    
    return { bin, model }
  } catch(e) {
    console.error('Error reading piper config:', e)
    const internalBin = join(_dirname, '../public/models/piper/bin/piper')
    const internalModel = join(_dirname, '../public/models/piper/es_ES-davefx-medium.onnx')
    return { bin: internalBin, model: internalModel }
  }
}

function setupIPC() {
  ipcMain.handle('tts:speak', async (event, text: string) => {
    const { bin, model } = getPiperConfig()
    
    if (!model) {
      console.error('TTS: No Piper model configured.')
      return null
    }

    const tempWav = join(os.tmpdir(), `tts_${Date.now()}.wav`)

    return new Promise((resolve, reject) => {
      const child = execFile(bin, ['--model', model, '--output_file', tempWav], async (error, stdout, stderr) => {
        if (error) {
          console.error('Piper TTS error:', error, stderr)
          resolve(null)
          return
        }
        
        try {
          const buffer = await fs.readFile(tempWav)
          await fs.unlink(tempWav)
          resolve(buffer)
        } catch(e) {
          console.error('Error reading temp wav:', e)
          resolve(null)
        }
      })
      
      child.stdin?.write(text)
      child.stdin?.end()
    })
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    fullscreen: true,
    webPreferences: {
      preload: join(_dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.setBackgroundColor('#ffffff')

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(_dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  setupIPC()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
