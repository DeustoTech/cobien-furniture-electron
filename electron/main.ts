import dotenv from 'dotenv'
dotenv.config()
import { app, BrowserWindow, ipcMain, protocol, net, session } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as fsSync from 'node:fs'
import { startBackendSync } from './services/backendSync'
import { getEvents, addPersonalEvent, updatePersonalEvent, deleteEvent } from './services/eventsMongo'
import { fetchMessages, deleteMessage, markMessageRead, submitQuickReply } from './services/boardService'
import { fetchWeatherBundle } from './services/weatherService'
import { getRandomJoke } from './services/jokesService'
import { loadContacts, requestCall, syncContacts } from './services/contactsService'

import { loadPendingReminders, addReminder, listReminders, deleteReminder } from './services/remindersService'
import { startMqtt, stopMqtt } from './services/mqttService'
import { adjustVolume, getVolume, adjustBrightness } from './services/hardwareService'

const _dirname = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

const configPath = join(_dirname, '../config/config.default.json')


function getPiperConfig(lang = 'es', gender = 'male') {
  try {
    const configPath = join(_dirname, '../config/config.default.json')
    const localPath = join(app.getPath('userData'), 'config.local.json')
    
    const defaultData = JSON.parse(fsSync.readFileSync(configPath, 'utf-8'))
    let localData = {}
    try {
      localData = JSON.parse(fsSync.readFileSync(localPath, 'utf-8'))
    } catch(e) {}
    
    const services = { ...defaultData.services, ...localData.services }
    
    const internalBin = join(_dirname, '../public/models/piper/bin/piper')
    const defaultModel = join(_dirname, '../public/models/piper/es_ES-davefx-medium.onnx')

    const bin = services.tts_piper_bin || internalBin
    
    // Determine model based on lang and gender
    let modelKey = `tts_piper_model_${lang}_${gender}`
    let modelName = services[modelKey] || services[`tts_piper_model_${lang}`]
    
    let model = ''

    if (modelName) {
      if (modelName.startsWith('/') || modelName.includes(':') || modelName.startsWith('http')) {
        model = modelName
      } else {
        // Try Electron public path
        const elPath = join(_dirname, '../public/models/piper', modelName)
        
        if (fsSync.existsSync(elPath)) {
          model = elPath
        } else {
          model = elPath // Fallback to Electron path
        }
      }
    } else {
      // Fallback based on hardcoded defaults if not in config
      if (lang === 'fr') model = join(_dirname, '../public/models/piper/fr_FR-siwis-medium.onnx')
      else if (lang === 'en') model = join(_dirname, '../public/models/piper/en_US-amy-medium.onnx')
      else model = defaultModel
    }
    
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

  ipcMain.handle('weather:fetch', async (_, cityName: string, lang = 'es') => {
    return await fetchWeatherBundle(cityName, lang)
  })

  ipcMain.handle('jokes:getRandom', async (_, lang = 'es') => {
    return await getRandomJoke(lang)
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
    const deviceApiKey = process.env.COBIEN_VIDEOCALL_DEVICE_API_KEY || ''
    const sessionUrl = process.env.COBIEN_DEVICE_VIDEOCALL_SESSION_URL || 'https://portal.co-bien.eu/api/device-videocall-session/'
    const devicePortalUrl = process.env.COBIEN_PORTAL_VIDEOCALL_DEVICE_URL || 'https://portal.co-bien.eu/videocall/device/'
    const answeredUrl = process.env.COBIEN_PORTAL_CALL_ANSWERED_URL || 'https://portal.co-bien.eu/api/call-answered/'
    const portalUrl = process.env.COBIEN_PORTAL_VIDEOCALL_URL || 'https://portal.co-bien.eu/videocall/'

    let targetUrl = `${portalUrl}?room=${encodeURIComponent(userName)}&device=${encodeURIComponent(deviceId)}`

    if (deviceApiKey) {
      try {
        console.log(`[VIDEOCALL] Fetching device session for room: ${userName}, device: ${deviceId}`)
        const sessionRes = await fetch(sessionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-DEVICE-ID': deviceId,
            'X-DEVICE-KEY': deviceApiKey
          },
          body: JSON.stringify({
            device_id: deviceId,
            room: userName
          }),
          signal: AbortSignal.timeout(8000)
        })

        if (sessionRes.ok) {
          const sessionData = await sessionRes.json()
          const { token, room_name, identity, call_answered_url } = sessionData
          
          if (token) {
            // Notify backend that the call is answered
            const targetAnsweredUrl = call_answered_url || answeredUrl
            try {
              console.log(`[VIDEOCALL] Notifying call answered to: ${targetAnsweredUrl}`)
              await fetch(targetAnsweredUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room: room_name, device: identity }),
                signal: AbortSignal.timeout(5000)
              })
            } catch (err) {
              console.error('[VIDEOCALL] Failed to notify backend call answered:', err)
            }

            // Build hash fragment URL
            targetUrl = `${devicePortalUrl}#token=${encodeURIComponent(token)}&room=${encodeURIComponent(room_name)}&identity=${encodeURIComponent(identity)}`
            console.log('[VIDEOCALL] Generated Twilio token URL successfully')
          }
        } else {
          console.warn(`[VIDEOCALL] Device session request failed with status: ${sessionRes.status}`)
        }
      } catch (err) {
        console.error('[VIDEOCALL] Error request session:', err)
      }
    }

    const { BrowserWindow: BW } = await import('electron')
    const callWin = new BW({
      width: 1024,
      height: 768,
      fullscreen: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    callWin.loadURL(targetUrl)

    // Intercept cobien://call-ended to close call window
    callWin.webContents.on('will-navigate', (event, url) => {
      if (url.startsWith('cobien://call-ended')) {
        event.preventDefault()
        callWin.close()
      }
    })
    callWin.webContents.on('did-start-navigation', (event, url) => {
      if (url.startsWith('cobien://call-ended')) {
        event.preventDefault()
        callWin.close()
      }
    })

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
    const defaultLocation = process.env.COBIEN_DEVICE_LOCATION || data.settings?.device_location || 'Bilbao'
    const deviceId = process.env.COBIEN_DEVICE_ID || 'CoBien6'
    // Ensure we don't override payload.location if it exists
    const location = payload.location || defaultLocation
    return await addPersonalEvent({ ...payload, location, deviceId })
  })

  ipcMain.handle('events:updatePersonal', async (_, payload: any) => {
    return await updatePersonalEvent(payload)
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
      deviceId: process.env.COBIEN_DEVICE_ID || 'CoBienX',
      contactsPath: join(app.getPath('userData'), 'contacts/list_contacts.txt'),
      defaultLanguage: process.env.COBIEN_APP_LANGUAGE || 'en'
    }
  })

  ipcMain.handle('app:restart', () => {
    app.relaunch()
    app.exit()
  })

  ipcMain.handle('app:exit', () => {
    app.quit()
  })

  let currentTtsProcess: any = null

  ipcMain.handle('tts:stop', () => {
    if (currentTtsProcess) {
      try { currentTtsProcess.kill() } catch(e) {}
      currentTtsProcess = null
    }
  })

  ipcMain.handle('tts:speak', async (event, text: string, lang = 'es', gender = 'male', engine = 'piper') => {
    console.log(`[TTS] Speaking (${lang}/${gender}) via ${engine}: "${text}"`)

    if (currentTtsProcess) {
      try { currentTtsProcess.kill() } catch(e) {}
      currentTtsProcess = null
    }
    
    const tempWav = join(os.tmpdir(), `tts_${Date.now()}.wav`)


    // XTTS engine removed. Defaulting to Piper implementation.
    // The engine selection UI and logic now only supports 'piper'.

    // Default: Piper
    const { bin, model } = getPiperConfig(lang, gender)
    console.log(`[TTS] Piper Config: bin=${bin}, model=${model}`)
    
    if (!model) {
      console.error('TTS: No Piper model configured.')
      return null
    }

    return new Promise((resolve) => {
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


  ipcMain.handle('hardware:adjustVolume', async (_, value: number, isAbsolute = false) => {
    return await adjustVolume(value, isAbsolute)
  })
  ipcMain.handle('hardware:adjustBrightness', async (_, value?: number) => {
    return await adjustBrightness(value)
  })
 
  ipcMain.handle('hardware:getVolume', async () => {
    return await getVolume()
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
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(_dirname, '../dist/index.html'))
  }
}
 
app.whenReady().then(() => {
  // Automatically grant camera/microphone/media permissions
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'geolocation', 'notifications', 'midiSysex', 'openExternal']
    if (allowed.includes(permission)) {
      callback(true)
    } else {
      callback(false)
    }
  })
  
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const allowed = ['media', 'geolocation', 'notifications', 'midiSysex', 'openExternal']
    return allowed.includes(permission)
  })

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
    const localPath = join(app.getPath('userData'), 'config.local.json')
    startBackendSync(mainWindow, configPath, localPath)
    // Start MQTT sensor bridge (gracefully handles broker not available)
    startMqtt(mainWindow)
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
