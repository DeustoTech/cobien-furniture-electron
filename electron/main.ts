import 'dotenv/config'
import { app, BrowserWindow, ipcMain } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as fsSync from 'node:fs'
import { startBackendSync } from './services/backendSync'
import { getEvents } from './services/eventsMongo'
import { fetchMessages, deleteMessage, markMessageRead, submitQuickReply } from './services/boardService'

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
  const configPath = join(_dirname, '../../../cobien_FrontEnd/app/config/config.default.json')

  ipcMain.handle('config:getWeather', async () => {
    try {
      const data = JSON.parse(await fs.readFile(configPath, 'utf-8'))
      return {
        catalog: data.settings.weather_city_catalog || [],
        active: data.settings.weather_cities || [],
        primary: data.settings.weather_primary_city || ''
      }
    } catch(e) {
      console.error('Error reading config:', e)
      return { catalog: [], active: [], primary: '' }
    }
  })

  ipcMain.handle('config:saveWeather', async (event, payload: any) => {
    try {
      const data = JSON.parse(await fs.readFile(configPath, 'utf-8'))
      data.settings.weather_city_catalog = payload.catalog
      data.settings.weather_cities = payload.active
      data.settings.weather_primary_city = payload.primary
      await fs.writeFile(configPath, JSON.stringify(data, null, 4))
      return true
    } catch(e) {
      console.error('Error saving config:', e)
      return false
    }
  })

  ipcMain.handle('events:get', async () => {
    return await getEvents(configPath)
  })

  ipcMain.handle('board:fetch', async () => await fetchMessages())
  ipcMain.handle('board:delete', async (_, id) => await deleteMessage(id))
  ipcMain.handle('board:read', async (_, id) => await markMessageRead(id))
  ipcMain.handle('board:reply', async (_, id, text) => await submitQuickReply(id, text))

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

  if (mainWindow) {
    const configPath = join(_dirname, '../../../cobien_FrontEnd/app/config/config.default.json')
    const localPath = join(_dirname, '../../../cobien_FrontEnd/app/config/config.local.json')
    startBackendSync(mainWindow, configPath, localPath)
  }

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
