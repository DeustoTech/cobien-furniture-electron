import dotenv from 'dotenv'
dotenv.config()
import { app, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as fsSync from 'node:fs'
import { startBackendSync } from './services/backendSync'
import { getEvents, addPersonalEvent, deleteEvent } from './services/eventsMongo'
import { fetchMessages, deleteMessage, markMessageRead, submitQuickReply } from './services/boardService'
import { fetchWeatherBundle } from './services/weatherService'
import { getRandomJoke } from './services/jokesService'
import { loadContacts, requestCall, syncContacts } from './services/contactsService'

import { loadPendingReminders, addReminder, listReminders, deleteReminder } from './services/remindersService'
import { startMqtt, stopMqtt } from './services/mqttService'
import { listenWithVosk } from './services/asrService'
import { adjustVolume, adjustBrightness } from './services/hardwareService'
import { startWakeWordDetection, stopWakeWordDetection } from './services/wakeWordService'



const _dirname = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

const configPath = join(_dirname, '../../../cobien_FrontEnd/app/config/config.default.json')


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

  ipcMain.handle('config:getSettings', async () => {
    try {
      const data = JSON.parse(await fs.readFile(configPath, 'utf-8'))
      return data.settings || {}
    } catch(e) {
      return {}
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

  ipcMain.handle('weather:fetch', async (_, cityName: string) => {
    return await fetchWeatherBundle(cityName)
  })

  ipcMain.handle('jokes:getRandom', async () => {
    return await getRandomJoke('es')
  })

  ipcMain.handle('contacts:list', async () => {
    return await loadContacts()
  })

  ipcMain.handle('contacts:sync', async () => {
    const apiKey = process.env.COBIEN_NOTIFY_API_KEY || ''
    const deviceId = process.env.COBIEN_DEVICE_ID || 'CoBien6'
    const data = JSON.parse(await fs.readFile(configPath, 'utf-8'))
    const baseUrl = (data.services?.backend_base_url || 'https://portal.co-bien.eu').replace(/\/$/, '')
    return await syncContacts(deviceId, apiKey, baseUrl)
  })


  ipcMain.handle('contacts:requestCall', async (_, userName: string) => {
    const apiKey = process.env.COBIEN_NOTIFY_API_KEY || ''
    const deviceId = process.env.COBIEN_DEVICE_ID || 'CoBien6'
    const data = JSON.parse(await fs.readFile(configPath, 'utf-8'))
    const baseUrl = (data.services?.portal_base_url || 'https://portal.co-bien.eu').replace(/\/$/, '')
    return await requestCall(userName, deviceId, apiKey, baseUrl)
  })

  ipcMain.handle('contacts:openCall', async (_, userName: string) => {
    const deviceId = process.env.COBIEN_DEVICE_ID || 'CoBien6'
    const data = JSON.parse(await fs.readFile(configPath, 'utf-8'))
    const baseUrl = (data.services?.portal_base_url || 'https://portal.co-bien.eu').replace(/\/$/, '')
    const url = `${baseUrl}/videocall/?room=${encodeURIComponent(userName)}&device=${encodeURIComponent(deviceId)}`

    const { BrowserWindow: BW } = await import('electron')
    const callWin = new BW({
      width: 1024,
      height: 768,
      fullscreen: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })
    callWin.loadURL(url)
    return true
  })

  ipcMain.handle('reminders:add', async (_, message: string, isoDatetime: string) => {
    return await addReminder(message, isoDatetime)
  })

  ipcMain.handle('reminders:list', async () => {
    return await listReminders()
  })

  ipcMain.handle('reminders:delete', async (_, id: string) => {
    return await deleteReminder(id)
  })

  ipcMain.handle('events:addPersonal', async (_, payload: any) => {
    const data = JSON.parse(await fs.readFile(configPath, 'utf-8'))
    const location = data.settings?.device_location || 'Bilbao'
    const deviceId = process.env.COBIEN_DEVICE_ID || 'CoBien6'
    return await addPersonalEvent({ ...payload, location, deviceId })
  })
  
  ipcMain.handle('events:delete', async (_, id: string) => {
    return await deleteEvent(id)
  })

  ipcMain.handle('board:fetch', async () => await fetchMessages())
  ipcMain.handle('board:delete', async (_, id) => await deleteMessage(id))
  ipcMain.handle('board:read', async (_, id) => await markMessageRead(id))
  ipcMain.handle('board:reply', async (_, id, text) => await submitQuickReply(id, text))

  ipcMain.handle('config:getSystemInfo', () => {
    return {
      version: app.getVersion(),
      deviceId: process.env.COBIEN_DEVICE_ID || 'CoBienX'
    }
  })

  ipcMain.handle('app:restart', () => {
    app.relaunch()
    app.exit()
  })

  ipcMain.handle('app:exit', () => {
    app.quit()
  })

  ipcMain.handle('tts:speak', async (event, text: string) => {
    console.log(`[TTS] Speaking: "${text}"`)
    const { bin, model } = getPiperConfig()
    console.log(`[TTS] Config: bin=${bin}, model=${model}`)
    
    if (!model) {
      console.error('TTS: No Piper model configured.')
      return null
    }

    const tempWav = join(os.tmpdir(), `tts_${Date.now()}.wav`)

    return new Promise((resolve, reject) => {
      const child = execFile(bin, ['--model', model, '--output_file', tempWav], async (error, stdout, stderr) => {
        if (error) {
          console.error('[TTS] Piper exec error:', error, stderr)
          resolve(null)
          return
        }
        
        try {
          const buffer = await fs.readFile(tempWav)
          await fs.unlink(tempWav)
          console.log(`[TTS] Generated WAV: ${buffer.length} bytes`)
          resolve(buffer)
        } catch(e) {
          console.error('[TTS] Error reading temp wav:', e)
          resolve(null)
        }
      })
      
      child.stdin?.write(text)
      child.stdin?.end()
    })

  })

  ipcMain.handle('stt:listen', async (event, language: string) => {
    return await listenWithVosk(language, (level) => {
      event.sender.send('asr:level', level)
    }, (partial) => {
      event.sender.send('asr:partial', partial)
    })
  })



  ipcMain.handle('hardware:adjustVolume', async (_, value: number, isAbsolute = false) => {
    return await adjustVolume(value, isAbsolute)
  })
  ipcMain.handle('hardware:adjustBrightness', async (_, value?: number) => {
    return await adjustBrightness(value)
  })

  ipcMain.handle('asr:restartWakeWord', () => {
    if (mainWindow) {
      startWakeWordDetection(mainWindow, _dirname)
    }
  })



}


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    fullscreen: false,

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
  protocol.handle('cobien-media', (request) => {
    const url = request.url.replace('cobien-media://', '')
    return net.fetch('file://' + url)
  })

  setupIPC()
  
  // Initial Syncs
  const data = JSON.parse(fsSync.readFileSync(configPath, 'utf-8'))
  const baseUrl = (data.services?.backend_base_url || 'https://portal.co-bien.eu').replace(/\/$/, '')
  const apiKey = process.env.COBIEN_NOTIFY_API_KEY || ''
  const deviceId = process.env.COBIEN_DEVICE_ID || 'CoBien6'
  syncContacts(deviceId, apiKey, baseUrl).catch(console.error)

  createWindow()


  // Load pending reminders and wire notification to renderer
  loadPendingReminders((reminder) => {
    if (mainWindow) {
      mainWindow.webContents.send('reminder:fire', reminder)
    }
  })

  if (mainWindow) {
    const configPath = join(_dirname, '../../../cobien_FrontEnd/app/config/config.default.json')
    const localPath = join(_dirname, '../../../cobien_FrontEnd/app/config/config.local.json')
    startBackendSync(mainWindow, configPath, localPath)
    // Start MQTT sensor bridge (gracefully handles broker not available)
    startMqtt(mainWindow)
    
    // Start background listening for "cobien"
    startWakeWordDetection(mainWindow, _dirname)
  }


  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopMqtt()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
