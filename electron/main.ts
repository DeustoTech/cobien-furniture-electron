import dotenv from 'dotenv'
dotenv.config()

// Restore VITE_DEV_SERVER_URL on relaunch if passed as command-line arg
const devUrlArg = process.argv.find(arg => arg.startsWith('--vite-dev-url='))
if (devUrlArg) {
  process.env.VITE_DEV_SERVER_URL = devUrlArg.split('=')[1]
}

import { app, BrowserWindow, ipcMain, protocol, net, session } from 'electron'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'cobien-media',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true,
      stream: true
    }
  }
])

import { execSync } from 'node:child_process'

// Disable hardware acceleration in virtual environments or when GPU is not functional
let gpuDisabled = false
try {
  const virt = execSync('systemd-detect-virt', { encoding: 'utf-8' }).trim()
  if (virt && virt !== 'none') {
    console.log(`[GPU] Virtual machine detected (${virt}). Disabling hardware acceleration.`)
    gpuDisabled = true
  }
} catch (e) {
  // Ignored if systemd-detect-virt is missing or returns non-zero
}

// Check if any DRI card device exists — if not, GPU rendering cannot work
if (!gpuDisabled) {
  try {
    const fsCheck = require('node:fs')
    const driEntries = fsCheck.existsSync('/dev/dri')
      ? fsCheck.readdirSync('/dev/dri').filter((f: string) => f.startsWith('card'))
      : []
    if (driEntries.length === 0) {
      console.log('[GPU] No DRI card devices found. Disabling hardware acceleration.')
      gpuDisabled = true
    }
  } catch (e) {
    // Ignore
  }
}

if (gpuDisabled) {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-gpu')
}

// Always disable VA-API to prevent FATAL crashes on systems with broken/missing VA-API drivers
// (e.g. VMs with DRI devices but no proper VA-API support). This does not affect rendering,
// only hardware video decode acceleration.
app.commandLine.appendSwitch('disable-features', 'VaapiVideoDecoder,VaapiVideoEncoder')

// Disable login keyring popups in kiosk environment
app.commandLine.appendSwitch('password-store', 'basic')
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile, exec } from 'node:child_process'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as fsSync from 'node:fs'
import { startBackendSync, setNetworkSpeed, triggerHeartbeat } from './services/backendSync'
import { getEvents, addPersonalEvent, updatePersonalEvent, deleteEvent } from './services/eventsMongo'
import { fetchMessages, deleteMessage, markMessageRead, submitQuickReply } from './services/boardService'
import { fetchWeatherBundle } from './services/weatherService'
import { getRandomJoke } from './services/jokesService'
import { loadContacts, requestCall, syncContacts } from './services/contactsService'

import { loadPendingReminders, addReminder, listReminders, deleteReminder } from './services/remindersService'
import { startMqtt, stopMqtt, publishButtonConfig, publishNotificationLed, turnOffNotificationLed, publishRfidInit, publishRfidConfig, publishRfidReload } from './services/mqttService'
import { adjustVolume, getVolume, adjustBrightness } from './services/hardwareService'

const _dirname = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let activeMockSSID = 'CoBien_WiFi_5G'
let lastManualConnectTime = 0

const configPath = join(_dirname, '../config/config.default.json')
let _localConfigPath = ''  // set once app is ready


function getPiperConfig(lang = 'es', gender = 'male') {
  try {
    const configPath = join(_dirname, '../config/config.default.json')
    const localPath = join(app.getPath('userData'), 'config.local.json')

    const defaultData = JSON.parse(fsSync.readFileSync(configPath, 'utf-8'))
    let localData = {}
    try {
      localData = JSON.parse(fsSync.readFileSync(localPath, 'utf-8'))
    } catch (e) { }

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
  } catch (e) {
    console.error('Error reading piper config:', e)
    const internalBin = join(_dirname, '../public/models/piper/bin/piper')
    const internalModel = join(_dirname, '../public/models/piper/es_ES-davefx-medium.onnx')
    return { bin: internalBin, model: internalModel }
  }
}


let lastMeasuredSpeed: number | null = null

/**
 * Download ~500 KB from a stable CDN and return the speed in kbps.
 * Uses Electron's net.request so it goes through the Chromium network stack
 * (proxy settings, SSL, etc. are all handled automatically).
 * Returns null on error or timeout.
 */
async function measureNetworkSpeed(): Promise<number | null> {
  // ~500 KB file hosted on a globally distributed CDN
  const TEST_URL = 'https://speed.cloudflare.com/__down?bytes=512000'
  const TIMEOUT_MS = 8000

  return new Promise((resolve) => {
    let byteCount = 0
    const startMs = Date.now()
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      // Partial result is still useful — use what we received
      const elapsedSec = (Date.now() - startMs) / 1000
      if (byteCount > 0 && elapsedSec > 0) {
        resolve(Math.round((byteCount * 8) / elapsedSec / 1000))
      } else {
        resolve(null)
      }
    }, TIMEOUT_MS)

    try {
      const request = net.request(TEST_URL)
      request.on('response', (response) => {
        response.on('data', (chunk: Buffer) => {
          byteCount += chunk.length
        })
        response.on('end', () => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          const elapsedSec = (Date.now() - startMs) / 1000
          if (elapsedSec > 0) {
            resolve(Math.round((byteCount * 8) / elapsedSec / 1000))
          } else {
            resolve(null)
          }
        })
        response.on('error', () => {
          if (!settled) { settled = true; clearTimeout(timer); resolve(null) }
        })
      })
      request.on('error', () => {
        if (!settled) { settled = true; clearTimeout(timer); resolve(null) }
      })
      request.end()
    } catch {
      if (!settled) { settled = true; clearTimeout(timer); resolve(null) }
    }
  })
}

function setupIPC() {
  async function readMergedConfig() {
    let defaultData: any = {}
    try {
      defaultData = JSON.parse(await fs.readFile(configPath, 'utf-8'))
    } catch (e) {
      console.error('Error reading default config:', e)
    }

    let localData: any = {}
    if (_localConfigPath) {
      try {
        localData = JSON.parse(await fs.readFile(_localConfigPath, 'utf-8'))
      } catch (e) {
        // Fine if local config is empty/doesn't exist
      }
    }

    return {
      ...defaultData,
      ...localData,
      settings: { ...(defaultData.settings || {}), ...(localData.settings || {}) },
      notifications: { ...(defaultData.notifications || {}), ...(localData.notifications || {}) },
      services: { ...(defaultData.services || {}), ...(localData.services || {}) }
    }
  }

  async function writeConfig(updater: (data: any) => void) {
    let defaultSuccess = false
    try {
      const defaultData = JSON.parse(await fs.readFile(configPath, 'utf-8'))
      updater(defaultData)
      await fs.writeFile(configPath, JSON.stringify(defaultData, null, 4))
      defaultSuccess = true
    } catch (e) {
      // Ignore write failures in production for default config (read-only asar/bundle)
    }

    let localSuccess = false
    if (_localConfigPath) {
      try {
        // Ensure the parent directory exists (critical for fresh VMs / first run)
        await fs.mkdir(dirname(_localConfigPath), { recursive: true })

        let localData: any = {}
        try {
          localData = JSON.parse(await fs.readFile(_localConfigPath, 'utf-8'))
        } catch (e) {}
        updater(localData)
        await fs.writeFile(_localConfigPath, JSON.stringify(localData, null, 4))
        localSuccess = true
      } catch (e) {
        console.error('[CONFIG] Error writing local config:', e)
      }
    } else {
      console.warn('[CONFIG] _localConfigPath not set, cannot persist settings locally')
    }

    return defaultSuccess || localSuccess
  }

  ipcMain.handle('config:getWeather', async () => {
    try {
      const data = await readMergedConfig()
      return {
        catalog: data.settings?.weather_city_catalog || [],
        active: data.settings?.weather_cities || [],
        primary: data.settings?.weather_primary_city || ''
      }
    } catch (e) {
      console.error('Error reading config:', e)
      return { catalog: [], active: [], primary: '' }
    }
  })

  ipcMain.handle('config:getSettings', async () => {
    try {
      const data = await readMergedConfig()
      return data.settings || {}
    } catch (e) {
      return {}
    }
  })

  ipcMain.handle('config:saveWeather', async (event, payload: any) => {
    try {
      const success = await writeConfig((data) => {
        if (!data.settings) data.settings = {}
        data.settings.weather_city_catalog = payload.catalog
        data.settings.weather_cities = payload.active
        data.settings.weather_primary_city = payload.primary
      })
      return success
    } catch (e) {
      console.error('Error saving config:', e)
      return false
    }
  })

  ipcMain.handle('config:saveButtonColors', async (event, payload: any) => {
    try {
      const success = await writeConfig((data) => {
        if (!data.settings) data.settings = {}
        data.settings.button_colors = payload
      })
      publishButtonConfig(payload)
      return success
    } catch (e) {
      console.error('Error saving button colors:', e)
      return false
    }
  })

  ipcMain.handle('config:getNotifications', async () => {
    try {
      const data = await readMergedConfig()
      return data.notifications || {}
    } catch (e) {
      return {}
    }
  })

  ipcMain.handle('config:saveNotifications', async (event, payload: any) => {
    try {
      const success = await writeConfig((data) => {
        data.notifications = payload
      })
      return success
    } catch (e) {
      console.error('Error saving notifications config:', e)
      return false
    }
  })

  ipcMain.handle('config:getRfidActions', async () => {
    try {
      const data = await readMergedConfig()
      return data.settings?.rfid_actions || {}
    } catch (e) {
      console.error('Error reading RFID actions:', e)
      return {}
    }
  })

  ipcMain.handle('config:initRfidConfigMode', async () => {
    publishRfidInit(1)
    return true
  })

  ipcMain.handle('config:cancelRfidConfigMode', async () => {
    publishRfidInit(0)
    return true
  })

  ipcMain.handle('config:saveRfidAction', async (event, cardId: number, action: string, extra = '') => {
    try {
      const success = await writeConfig((data) => {
        if (!data.settings) data.settings = {}
        if (!data.settings.rfid_actions) data.settings.rfid_actions = {}
        data.settings.rfid_actions[String(cardId)] = { action, extra }
      })

      // Map action to code: day_events=2, weather=3, videocall=5
      const actionCodes: Record<string, number> = {
        day_events: 2,
        weather: 3,
        videocall: 5
      }
      const code = actionCodes[action] ?? 2

      // Publish config and reload via MQTT
      publishRfidConfig(cardId, code)
      publishRfidReload()
      return success
    } catch (e) {
      console.error('Error saving RFID action:', e)
      return false
    }
  })

  ipcMain.handle('config:deleteRfidAction', async (event, cardId: number) => {
    try {
      const success = await writeConfig((data) => {
        if (data.settings?.rfid_actions) {
          delete data.settings.rfid_actions[String(cardId)]
        }
      })

      // Publish reload via MQTT
      publishRfidReload()
      return success
    } catch (e) {
      console.error('Error deleting RFID action:', e)
      return false
    }
  })

  ipcMain.handle('config:getRingtones', async () => {
    try {
      const devPath = join(app.getAppPath(), 'public', 'audio', 'ringtones')
      const prodPath = join(app.getAppPath(), 'dist', 'audio', 'ringtones')
      
      let ringtonesDir = devPath
      try {
        await fs.access(prodPath)
        ringtonesDir = prodPath
      } catch {
        // Fallback to devPath
      }

      const files = await fs.readdir(ringtonesDir)
      const supported = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']
      return files.filter(f => supported.some(ext => f.toLowerCase().endsWith(ext)))
    } catch (e) {
      console.error('Error reading ringtones:', e)
      return []
    }
  })

  ipcMain.handle('config:triggerNotificationLed', async (event, type: string) => {
    try {
      const data = await readMergedConfig()
      const notif = data.notifications?.[type]
      if (notif) {
        publishNotificationLed(notif)
        return true
      }
      return false
    } catch (e) {
      console.error('Error triggering notification LED:', e)
      return false
    }
  })

  ipcMain.handle('config:turnOffNotificationLed', async () => {
    try {
      turnOffNotificationLed()
      return true
    } catch (e) {
      console.error('Error turning off notification LED:', e)
      return false
    }
  })

  ipcMain.handle('config:simulateNotification', async (event, type: string) => {
    try {
      let notif: any = {}
      if (type === 'videollamada') {
        notif = { type: 'videocall', from: 'Test Caller', room: 'test-room' }
      } else if (type === 'nuevo_evento') {
        notif = { type: 'new_event', title: 'Reunión de prueba', date: '2026-06-25' }
      } else if (type === 'nueva_foto') {
        notif = { type: 'new_message', from: 'Test Sender' }
      } else {
        return false
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backend:notification', notif)
        return true
      }
      return false
    } catch (e) {
      console.error('Error simulating notification:', e)
      return false
    }
  })

  const parseNmcliOutput = (stdout: string): { ssid: string; signal: number; security: string; active: boolean }[] => {
    const lines = stdout.split('\n')
    const results: { ssid: string; signal: number; security: string; active: boolean }[] = []
    for (const line of lines) {
      if (!line.trim()) continue
      const parts = line.split(/(?<!\\):/)
      if (parts.length < 4) continue
      const ssid = parts[0].replace(/\\:/g, ':').trim()
      if (!ssid) continue
      const signal = parseInt(parts[1], 10) || 0
      const security = parts[2].replace(/\\:/g, ':').trim()
      const activeVal = parts[3].trim().toLowerCase()
      const active = activeVal === 'yes' || activeVal === '*' || activeVal === 'sí' || activeVal === 'si'
      const existing = results.find(r => r.ssid === ssid)
      if (existing) {
        if (active) existing.active = true
        if (signal > existing.signal) {
          existing.signal = signal
          existing.security = security
        }
      } else {
        results.push({ ssid, signal, security, active })
      }
    }
    return results
  }

  ipcMain.handle('config:scanWifi', async () => {
    const runScanWifi = async (): Promise<{ ssid: string; signal: number; security: string; active: boolean }[]> => {
      const hostScanFile = '/tmp/host_wifi_list.txt'
      try {
        if (fsSync.existsSync(hostScanFile)) {
          const content = await fs.readFile(hostScanFile, 'utf-8')
          if (content.trim()) {
            return parseNmcliOutput(content)
          }
        }
      } catch (err) {
        console.error('Failed to read host wifi list:', err)
      }

      return new Promise((resolve) => {
        exec('nmcli device wifi rescan', () => {
          exec('nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE device wifi list', (error, stdout) => {
            if (error || !stdout) {
              resolve([])
              return
            }
            resolve(parseNmcliOutput(stdout))
          })
        })
      })
    }

    let list = await runScanWifi()
    if (list.length === 0) {
      list = [
        { ssid: 'CoBien_WiFi_5G', signal: 95, security: 'WPA2', active: activeMockSSID === 'CoBien_WiFi_5G' },
        { ssid: 'Deusto_Guest', signal: 72, security: 'WPA2', active: activeMockSSID === 'Deusto_Guest' },
        { ssid: 'Euskaltel_WiFi', signal: 50, security: 'WPA/WPA2', active: activeMockSSID === 'Euskaltel_WiFi' },
        { ssid: 'Library_Public', signal: 45, security: '', active: activeMockSSID === 'Library_Public' },
        { ssid: 'IoT_Sensors', signal: 30, security: 'WPA2', active: activeMockSSID === 'IoT_Sensors' }
      ]
    }
    return list
  })

  ipcMain.handle('config:connectWifi', async (event, ssid: string, password?: string) => {
    lastManualConnectTime = Date.now()
    const runScanWifi = async (): Promise<{ ssid: string; signal: number; security: string; active: boolean }[]> => {
      const hostScanFile = '/tmp/host_wifi_list.txt'
      try {
        if (fsSync.existsSync(hostScanFile)) {
          const content = await fs.readFile(hostScanFile, 'utf-8')
          if (content.trim()) {
            return parseNmcliOutput(content)
          }
        }
      } catch (err) {
        console.error('Failed to read host wifi list:', err)
      }

      return new Promise((resolve) => {
        exec('nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE device wifi list', (error, stdout) => {
          if (error || !stdout) {
            resolve([])
            return
          }
          resolve(parseNmcliOutput(stdout))
        })
      })
    }

    const runConnectWifi = async (targetSsid: string, pass?: string): Promise<boolean> => {
      const exists = await new Promise<boolean>((resolve) => {
        exec('nmcli -t -f NAME connection show', (error, stdout) => {
          if (error || !stdout) {
            resolve(false)
            return
          }
          const names = stdout.split('\n').map(n => n.trim())
          resolve(names.includes(targetSsid))
        })
      })

      if (exists) {
        console.log(`[WIFI] Connection profile for "${targetSsid}" already exists. Attempting to bring it up...`)
        const upSuccess = await new Promise<boolean>((resolve) => {
          exec(`nmcli connection up "${targetSsid.replace(/"/g, '\\"')}"`, (error, stdout, stderr) => {
            if (error) {
              console.warn(`[WIFI] Failed to bring up existing connection "${targetSsid}":`, error, stderr)
              resolve(false)
            } else {
              console.log(`[WIFI] Successfully brought up existing connection "${targetSsid}".`)
              resolve(true)
            }
          })
        })
        if (upSuccess) return true
      }

      console.log(`[WIFI] Creating/updating connection for "${targetSsid}"...`)
      return new Promise((resolve) => {
        let cmd = `nmcli device wifi connect "${targetSsid.replace(/"/g, '\\"')}"`
        if (pass) {
          cmd += ` password "${pass.replace(/"/g, '\\"')}"`
        }
        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            console.error('Error connecting to wifi:', error, stderr)
            resolve(false)
          } else {
            resolve(true)
          }
        })
      })
    }

    const hasWifiDevice = (): Promise<boolean> => {
      return new Promise((resolve) => {
        exec('nmcli -t -f TYPE device', (error, stdout) => {
          if (error || !stdout) {
            resolve(false)
            return
          }
          resolve(stdout.split('\n').some(line => line.trim() === 'wifi'))
        })
      })
    }

    const realList = await runScanWifi()
    const hasWifi = await hasWifiDevice()
    const isMockNetwork = !hasWifi || !realList.some(r => r.ssid === ssid)

    if (isMockNetwork) {
      console.log(`[WIFI] Simulating connection to mock/real network (no physical wifi interface or mock network): ${ssid}`)
      await new Promise(resolve => setTimeout(resolve, 2000))
      if (password === 'fail' || password === 'error') {
        return false
      }
      activeMockSSID = ssid
      return true
    } else {
      console.log(`[WIFI] Connecting to real network: ${ssid}`)
      const success = await runConnectWifi(ssid, password)
      if (success) {
        activeMockSSID = ''
      }
      return success
    }
  })

  ipcMain.handle('config:getCurrentWifi', async () => {
    const runGetActiveWifi = (): Promise<string | null> => {
      const hostScanFile = '/tmp/host_wifi_list.txt'
      try {
        if (fsSync.existsSync(hostScanFile)) {
          const content = fsSync.readFileSync(hostScanFile, 'utf-8')
          if (content.trim()) {
            const list = parseNmcliOutput(content)
            const activeItem = list.find(item => item.active)
            if (activeItem) {
              return Promise.resolve(activeItem.ssid)
            }
          }
        }
      } catch (err) {
        console.error('Failed to read host active wifi:', err)
      }

      return new Promise((resolve) => {
        exec("nmcli -t -f NAME,TYPE connection show --active", (error, stdout) => {
          if (error || !stdout) {
            resolve(null)
            return
          }
          const lines = stdout.split('\n')
          for (const line of lines) {
            const parts = line.split(/(?<!\\):/)
            if (parts.length >= 2 && parts[1].trim() === '802-11-wireless') {
              resolve(parts[0].replace(/\\:/g, ':').trim())
              return
            }
          }
          resolve(null)
        })
      })
    }

    const active = await runGetActiveWifi()
    if (active) return active
    return activeMockSSID
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
    const deviceId = process.env.COBIEN_DEVICE_ID
    if (!deviceId) {
      console.error('ERROR: COBIEN_DEVICE_ID not set. Exiting.');
      process.exit(1);
    }
    const data = await readMergedConfig()
    const baseUrl = (data.services?.backend_base_url || 'https://portal.co-bien.eu').replace(/\/$/, '')
    return await syncContacts(deviceId, apiKey, baseUrl)
  })


  ipcMain.handle('contacts:requestCall', async (_, userName: string) => {
    const apiKey = process.env.COBIEN_NOTIFY_API_KEY || ''
    const deviceId = process.env.COBIEN_DEVICE_ID
    if (!deviceId) {
      console.error('ERROR: COBIEN_DEVICE_ID not set. Exiting.');
      process.exit(1);
    }
    const data = await readMergedConfig()
    const baseUrl = (data.services?.portal_base_url || 'https://portal.co-bien.eu').replace(/\/$/, '')
    return await requestCall(userName, deviceId, apiKey, baseUrl)
  })

  ipcMain.handle('contacts:openCall', async (_, userName: string) => {
    const deviceId = process.env.COBIEN_DEVICE_ID
    if (!deviceId) {
      console.error('ERROR: COBIEN_DEVICE_ID not set. Exiting.');
      process.exit(1);
    }
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

    const closeWindowCleanly = () => {
      if (callWin.isDestroyed()) return
      try {
        callWin.hide()
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
          mainWindow.focus()
        }
        callWin.loadURL('about:blank')
        setTimeout(() => {
          if (!callWin.isDestroyed()) {
            callWin.close()
          }
        }, 500)
      } catch (e) {
        console.error('[VIDEOCALL] Error during clean close:', e)
      }
    }

    callWin.on('closed', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show()
        mainWindow.focus()
      }
    })

    callWin.loadURL(targetUrl)

    // Intercept cobien://call-ended to close call window cleanly
    callWin.webContents.on('will-navigate', (event, url) => {
      if (url.startsWith('cobien://call-ended')) {
        event.preventDefault()
        closeWindowCleanly()
      }
    })
    callWin.webContents.on('did-start-navigation', (event, url) => {
      if (url.startsWith('cobien://call-ended')) {
        event.preventDefault()
        closeWindowCleanly()
      }
    })
    callWin.webContents.on('will-frame-navigate', (event) => {
      if (event.url.startsWith('cobien://call-ended')) {
        event.preventDefault()
        closeWindowCleanly()
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
    const data = await readMergedConfig()
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

  ipcMain.handle('config:getSystemInfo', async () => {
    let rustdeskId = ''
    try {
      rustdeskId = await new Promise<string>((resolve) => {
        exec('rustdesk --get-id', (error, stdout) => {
          if (error) {
            resolve('')
          } else {
            resolve(stdout.trim())
          }
        })
      })
    } catch (e) {
      // Ignore
    }

    return {
      version: app.getVersion(),
      deviceId: process.env.COBIEN_DEVICE_ID || 'CoBienX',
      contactsPath: join(app.getPath('userData'), 'contacts/list_contacts.txt'),
      defaultLanguage: process.env.COBIEN_APP_LANGUAGE || 'en',
      rustdeskId,
      networkSpeedKbps: lastMeasuredSpeed
    }
  })

  ipcMain.handle('config:measureNetworkSpeed', async () => {
    const kbps = await measureNetworkSpeed()
    lastMeasuredSpeed = kbps
    // Persist the result so the next (and immediate) heartbeat includes it
    setNetworkSpeed(kbps)
    // Fire a heartbeat right away so the portal sees the fresh value immediately
    if (_localConfigPath) {
      triggerHeartbeat(configPath, _localConfigPath).catch(() => {})
    }
    return kbps
  })

  ipcMain.handle('app:restart', () => {
    console.log('[Main] Restarting application via window reload...')
    if (process.env.VITE_DEV_SERVER_URL) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
      }
    } else {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadFile(join(_dirname, '../dist/index.html'))
      } else {
        app.relaunch()
        app.exit(0)
      }
    }
  })

  ipcMain.handle('app:exit', () => {
    app.quit()
  })

  ipcMain.handle('app:update', async () => {
    console.log('[Main] Manual update requested from GUI.')
    const runtimeStateDir = process.env.COBIEN_RUNTIME_STATE_DIR || join(os.homedir(), '.local/state/cobien/runtime')
    const flagPath = join(runtimeStateDir, 'manual_update_reload.flag')
    
    try {
      await fs.mkdir(runtimeStateDir, { recursive: true })
      await fs.writeFile(flagPath, JSON.stringify({ requested_at: new Date().toISOString() }))
      console.log(`[Main] Created manual update reload flag at: ${flagPath}`)
    } catch (e: any) {
      console.error('[Main] Failed to write manual update reload flag:', e.message || e)
    }

    return new Promise((resolve, reject) => {
      const cmd = 'systemctl --user start cobien-update.service'
      console.log(`[Main] Executing update command: ${cmd}`)
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`[Main] Failed to start update service:`, error)
          reject(error)
        } else {
          console.log(`[Main] Update service started successfully:`, stdout)
          resolve(true)
        }
      })
    })
  })

  ipcMain.handle('app:uninstall', async () => {
    const username = os.userInfo().username
    const homeDir = os.homedir()
    const scriptPath = join(homeDir, 'cobien/cobien-furniture-app-launcher/uninstall-cobien-furniture-environment.sh')
    console.log(`[Uninstall] Target script path: ${scriptPath} (resolving for user: ${username})`)

    return new Promise((resolve, reject) => {
      const cmd = `echo "cobien" | sudo -S systemd-run --system --collect --setenv=COBIEN_SETUP_USER=${username} --setenv=COBIEN_NON_INTERACTIVE=1 --setenv=COBIEN_AUTO_CONFIRM=1 --setenv=COBIEN_AUTO_REBOOT_AFTER_UNINSTALL=1 bash "${scriptPath}"`
      console.log(`[Uninstall] Running command: ${cmd}`)
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`[Uninstall] Script error:`, error)
          console.error(`[Uninstall] Script stderr:`, stderr)
          reject(error)
        } else {
          console.log(`[Uninstall] Script stdout:`, stdout)
          resolve(true)
        }
      })
    })
  })

  let currentTtsProcess: any = null

  ipcMain.handle('tts:stop', () => {
    if (currentTtsProcess) {
      try { currentTtsProcess.kill() } catch (e) { }
      currentTtsProcess = null
    }
  })

  ipcMain.handle('tts:speak', async (event, text: string, lang = 'es', gender = 'male', engine = 'piper') => {
    console.log(`[TTS] Speaking (${lang}/${gender}) via ${engine}: "${text}"`)

    if (currentTtsProcess) {
      try { currentTtsProcess.kill() } catch (e) { }
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
        } catch (e) {
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
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      if (process.env.VITE_DEV_SERVER_URL && validatedURL.startsWith(process.env.VITE_DEV_SERVER_URL)) {
        console.log(`[Main] Failed to load dev URL (error: ${errorDescription}). Retrying in 1s...`)
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!)
          }
        }, 1000)
      }
    })
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
    try {
      const parsed = new URL(request.url)
      let filePath = decodeURIComponent(parsed.pathname)
      if (parsed.hostname && parsed.hostname !== 'localhost') {
        filePath = '/' + decodeURIComponent(parsed.hostname) + filePath
      }
      return net.fetch('file://' + filePath)
    } catch (e) {
      console.error('[PROTOCOL] Failed to parse custom media URL:', request.url, e)
      return new Response('Invalid URL', { status: 400 })
    }
  })

  // Initialize the writable local config path BEFORE registering IPC handlers
  const localConfigPath = join(app.getPath('userData'), 'config.local.json')
  _localConfigPath = localConfigPath

  setupIPC()

  // Initial Syncs
  const data = JSON.parse(fsSync.readFileSync(configPath, 'utf-8'))
  let localData: any = {}
  try {
    if (fsSync.existsSync(localConfigPath)) {
      localData = JSON.parse(fsSync.readFileSync(localConfigPath, 'utf-8'))
    }
  } catch (e) { }

  const services = { ...data.services, ...localData.services }
  const settings = { ...data.settings, ...localData.settings }

  const baseUrl = (services.backend_base_url || 'https://portal.co-bien.eu').replace(/\/$/, '')
  const apiKey = process.env.COBIEN_NOTIFY_API_KEY || services.notify_api_key || ''
  const deviceId = process.env.COBIEN_DEVICE_ID || settings.device_id
  // Verify device ID is present
  if (!deviceId) {
    console.error('ERROR: COBIEN_DEVICE_ID not set. Exiting.');
    process.exit(1);
  }

  // Initial contacts sync
  syncContacts(deviceId, apiKey, baseUrl).catch(console.error);

  // Periodic contacts sync (default every 5 minutes, configurable via COBIEN_CONTACTS_SYNC_INTERVAL_SEC)
  let pollIntervalSec = parseInt(process.env.COBIEN_CONTACTS_SYNC_INTERVAL_SEC || '300', 10);
  if (pollIntervalSec < 60) {
    pollIntervalSec = 300; // Enforce a safe minimum of 5 minutes to prevent overloading the server
  }
  if (pollIntervalSec > 0) {
    setInterval(() => {
      console.log('[CONTACTS] Periodic sync started');
      syncContacts(deviceId, apiKey, baseUrl)
        .then(() => {
          // Notify renderer to refresh contacts UI if needed
          if (mainWindow) {
            mainWindow.webContents.send('contacts:updated');
          }
        })
        .catch(console.error);
    }, pollIntervalSec * 1000);
  }

  createWindow()

  startWifiWatchdog()

  // Load pending reminders and wire notification to renderer
  loadPendingReminders((reminder) => {
    if (mainWindow) {
      mainWindow.webContents.send('reminder:fire', reminder)
    }
  })

  if (mainWindow) {
    startBackendSync(mainWindow, configPath, localConfigPath)
    // Start MQTT sensor bridge (gracefully handles broker not available)
    startMqtt(mainWindow)
  }


  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

function startWifiWatchdog() {
  setInterval(async () => {
    try {
      const hasWifi = await new Promise<boolean>((resolve) => {
        exec('nmcli -t -f TYPE device', (error, stdout) => {
          if (error || !stdout) {
            resolve(false)
            return
          }
          resolve(stdout.split('\n').some(line => line.trim() === 'wifi'))
        })
      })
      if (!hasWifi) return

      const isConnected = await new Promise<boolean>((resolve) => {
        exec('nmcli -t -f TYPE,STATE device', (error, stdout) => {
          if (error || !stdout) {
            resolve(false)
            return
          }
          const lines = stdout.split('\n').map(l => l.trim())
          const connected = lines.some(line => {
            const [type, state] = line.split(':')
            return type === 'wifi' && state === 'connected'
          })
          resolve(connected)
        })
      })

      if (isConnected) return

      if (Date.now() - lastManualConnectTime < 120 * 1000) {
        return
      }

      const isCobienInRange = await new Promise<boolean>((resolve) => {
        exec('nmcli -t -f SSID device wifi list', (error, stdout) => {
          if (error || !stdout) {
            resolve(false)
            return
          }
          const ssids = stdout.split('\n').map(s => s.trim())
          resolve(ssids.includes('cobien'))
        })
      })

      if (isCobienInRange) {
        console.log('[WIFI-WATCHDOG] Device is offline, and "cobien" SSID is in range. Auto-connecting to default Wi-Fi...')
        exec('nmcli device wifi connect "cobien" password "Cobien2026"', (err, stdout, stderr) => {
          if (err) {
            console.error('[WIFI-WATCHDOG] Failed to auto-connect to cobien Wi-Fi:', err, stderr)
          } else {
            console.log('[WIFI-WATCHDOG] Successfully auto-connected to cobien Wi-Fi.')
          }
        })
      }
    } catch (err) {
      console.error('[WIFI-WATCHDOG] Error in watchdog loop:', err)
    }
  }, 30 * 1000)
}

app.on('window-all-closed', () => {
  stopMqtt()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
