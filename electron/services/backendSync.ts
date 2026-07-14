import { BrowserWindow, ipcMain, app } from 'electron'
import { promises as fs } from 'node:fs'
import * as net from 'node:net'
import { exec } from 'node:child_process'
import { join } from 'node:path'
import * as os from 'node:os'

import { logNavigation, logNotificationReceived } from './icsoService'

let currentScreen = 'home'
let lastNetworkSpeedKbps: number | null = null
let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null
let pollIntervalId: ReturnType<typeof setInterval> | null = null

/** Called from main.ts after a speed measurement so heartbeat picks it up. */
export function setNetworkSpeed(kbps: number | null) {
  lastNetworkSpeedKbps = kbps
}

/** Fire a heartbeat immediately (e.g. after updating speed). */
export async function triggerHeartbeat(configPath: string, localConfigPath: string) {
  return sendHeartbeat(configPath, localConfigPath)
}

export async function startBackendSync(mainWindow: BrowserWindow, configPath: string, localConfigPath: string) {
  // Listen for route changes from Vue Router
  ipcMain.handle('app:route-changed', (event, routeName: string, source?: string) => {
    currentScreen = routeName
    try {
      logNavigation(routeName, (source || 'touchscreen') as any)
    } catch (e) {
      console.error('[SYNC] Failed to log navigation:', e)
    }
  })

  // Start background intervals
  let heartbeatIntervalSec = parseInt(process.env.COBIEN_DEVICE_HEARTBEAT_INTERVAL_SEC || '300', 10)
  if (isNaN(heartbeatIntervalSec) || heartbeatIntervalSec < 120) {
    heartbeatIntervalSec = 300 // default to 5 minutes to reduce server load
  }
  console.log(`[SYNC] Heartbeat interval set to ${heartbeatIntervalSec}s`)
  heartbeatIntervalId = setInterval(() => sendHeartbeat(configPath, localConfigPath), heartbeatIntervalSec * 1000)
  
  let pollIntervalSec = parseInt(process.env.COBIEN_DEVICE_POLL_INTERVAL_SEC || '10', 10)
  if (isNaN(pollIntervalSec) || pollIntervalSec < 5) {
    pollIntervalSec = 10 // Enforce a safe minimum of 5 seconds to reduce server load
  }
  console.log(`[SYNC] Notification polling interval set to ${pollIntervalSec}s`)
  pollIntervalId = setInterval(() => pollNotifications(mainWindow, configPath, localConfigPath), pollIntervalSec * 1000)

  // Fire immediately on start
  sendHeartbeat(configPath, localConfigPath)
  pollNotifications(mainWindow, configPath, localConfigPath)
}

export function stopBackendSync() {
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId)
    heartbeatIntervalId = null
  }
  if (pollIntervalId) {
    clearInterval(pollIntervalId)
    pollIntervalId = null
  }
  console.log('[SYNC] Backend sync stopped.')
}

async function getConfig(configPath: string, localConfigPath: string) {
  try {
    const defaultData = JSON.parse(await fs.readFile(configPath, 'utf-8'))
    let localData: any = {}
    try {
      localData = JSON.parse(await fs.readFile(localConfigPath, 'utf-8'))
    } catch(e) {}
    
    return {
      services: { ...defaultData.services, ...localData.services },
      settings: { ...defaultData.settings, ...localData.settings }
    }
  } catch(e) {
    return { services: {}, settings: {} }
  }
}

function isProcessRunning(pattern: string, exact: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const cmd = exact ? `pgrep -x "${pattern}"` : `pgrep -f "${pattern}"`
    exec(cmd, (error) => {
      resolve(!error)
    })
  })
}

function checkTcpPort(port: number, host: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let resolved = false
    
    socket.setTimeout(timeoutMs)
    
    socket.once('connect', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy()
        resolve(true)
      }
    })
    
    socket.once('timeout', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy()
        resolve(false)
      }
    })
    
    socket.once('error', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy()
        resolve(false)
      }
    })
    
    socket.connect(port, host)
  })
}

async function readSysFile(path: string): Promise<string> {
  try {
    return (await fs.readFile(path, 'utf-8')).trim()
  } catch (e) {
    return ''
  }
}

async function checkMosquitto(): Promise<string> {
  try {
    const running = await isProcessRunning('mosquitto', true)
    if (!running) return 'error'
    const portOpen = await checkTcpPort(1883, 'localhost', 2000)
    return portOpen ? 'ok' : 'warn'
  } catch (e) {
    return 'unknown'
  }
}

async function checkBridge(): Promise<string> {
  try {
    const running = await isProcessRunning('cobien_bridge', false)
    if (!running) return 'error'
    const portOpen = await checkTcpPort(1883, 'localhost', 2000)
    return portOpen ? 'ok' : 'warn'
  } catch (e) {
    return 'unknown'
  }
}

function checkCan(canStatus: any): string {
  if (!canStatus || canStatus.operstate !== 'up') {
    return 'error'
  }
  const totalPackets = canStatus.rx_packets + canStatus.tx_packets
  return totalPackets > 0 ? 'ok' : 'warn'
}

async function sendHeartbeat(configPath: string, localConfigPath: string) {
  const { services, settings } = await getConfig(configPath, localConfigPath)
  const url = services.device_heartbeat_url || 'https://portal.co-bien.eu/pizarra/api/devices/heartbeat/'
  const apiKey = process.env.COBIEN_NOTIFY_API_KEY || process.env.NOTIFY_API_KEY || services.notify_api_key || ''
  const deviceId = process.env.COBIEN_DEVICE_ID || settings.device_id || 'CoBien6'

  // Build CAN status
  let canStatus: any = null
  try {
    const operstate = await readSysFile('/sys/class/net/can0/operstate')
    if (operstate) {
      const carrier = await readSysFile('/sys/class/net/can0/carrier')
      const rxPackets = parseInt(await readSysFile('/sys/class/net/can0/statistics/rx_packets') || '0', 10)
      const txPackets = parseInt(await readSysFile('/sys/class/net/can0/statistics/tx_packets') || '0', 10)
      const rxErrors = parseInt(await readSysFile('/sys/class/net/can0/statistics/rx_errors') || '0', 10)
      const txErrors = parseInt(await readSysFile('/sys/class/net/can0/statistics/tx_errors') || '0', 10)
      canStatus = {
        present: true,
        operstate,
        carrier,
        rx_packets: isNaN(rxPackets) ? 0 : rxPackets,
        tx_packets: isNaN(txPackets) ? 0 : txPackets,
        rx_errors: isNaN(rxErrors) ? 0 : rxErrors,
        tx_errors: isNaN(txErrors) ? 0 : txErrors,
      }
    }
  } catch (e) {
    // Best effort
  }

  // Build services status
  const mosquittoStatus = await checkMosquitto()
  const bridgeStatus = await checkBridge()
  const canInterfaceStatus = checkCan(canStatus)

  // Get RustDesk ID if available
  let rustdeskId = ''
  try {
    rustdeskId = await new Promise<string>((resolve) => {
      exec('rustdesk --get-id', (error, stdout) => {
        if (error) resolve('')
        else resolve(stdout.trim())
      })
    })
  } catch (e) {
    // Ignore
  }

  const payload: any = {
    device_id: deviceId,
    screen: currentScreen,
    sent_at: new Date().toISOString(),
    software_version: `Electron-v${app.getVersion()}`,
    rustdesk_id: rustdeskId,
    ...(lastNetworkSpeedKbps !== null ? { network_speed_kbps: lastNetworkSpeedKbps } : {}),
    services_status: {
      app: 'ok',
      mosquitto: mosquittoStatus,
      mqtt_can_bridge: bridgeStatus,
      can_interface: canInterfaceStatus,
      checked_at: new Date().toISOString()
    }
  }

  if (canStatus) {
    payload.can_status = canStatus
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey
      },
      body: JSON.stringify(payload)
    })
    
    if (!res.ok) {
      console.warn(`[HEARTBEAT] Failed with status: ${res.status}`)
    } else {
      console.log(`[HEARTBEAT] Sent (Screen: ${currentScreen})`)
    }
  } catch(e) {
    console.error(`[HEARTBEAT] Network error`)
  }
}

async function pollNotifications(mainWindow: BrowserWindow, configPath: string, localConfigPath: string) {
  const { services, settings } = await getConfig(configPath, localConfigPath)
  const url = services.device_poll_url || 'https://portal.co-bien.eu/pizarra/api/device/poll/'
  const apiKey = process.env.COBIEN_NOTIFY_API_KEY || process.env.NOTIFY_API_KEY || services.notify_api_key || ''
  const deviceId = process.env.COBIEN_DEVICE_ID || settings.device_id || 'CoBien6'

  try {
    const res = await fetch(`${url}?device_id=${deviceId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey
      }
    })
    
    if (res.ok) {
      const data = await res.json()
      const notifications = data.notifications || []
      
      if (notifications.length > 0) {
        console.log(`[POLL] Received ${notifications.length} notifications`)
        let reloadEvents = false
        notifications.forEach((notif: any) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('backend:notification', notif)
          }
          const type = (notif.type || '').toLowerCase()
          if (type === 'new_event' || type === 'events_reload') {
            reloadEvents = true
            if (type === 'new_event') {
              try {
                logNotificationReceived('event')
              } catch (e) {
                console.error('[POLL] Failed to log remote event received:', e)
              }
            }
          }
          if (type === 'force_update') {
            console.log('[POLL] Force update notification received. Triggering manual update...')
            const runtimeStateDir = process.env.COBIEN_RUNTIME_STATE_DIR || join(os.homedir(), '.local/state/cobien/runtime')
            const flagPath = join(runtimeStateDir, 'manual_update_reload.flag')
            fs.mkdir(runtimeStateDir, { recursive: true })
              .then(() => fs.writeFile(flagPath, JSON.stringify({ requested_at: new Date().toISOString() })))
              .then(() => {
                console.log(`[POLL] Created manual update reload flag at: ${flagPath}`)
                exec('systemctl --user start cobien-update.service', (error, stdout, stderr) => {
                  if (error) {
                    console.error('[POLL] Failed to start update service:', error)
                  } else {
                    console.log('[POLL] Update service started successfully:', stdout)
                  }
                })
              })
              .catch((err) => {
                console.error('[POLL] Failed to prepare manual update reload flag:', err)
              })
          } else if (type === 'restart') {
            console.log('[POLL] Restart notification received. Rebooting device...')
            exec('systemctl reboot -i || echo cobien | sudo -S systemctl reboot -i || echo cobien | sudo -S reboot -f || reboot', (error, stdout, stderr) => {
              if (error) {
                console.error('[POLL] Failed to reboot device:', error)
              } else {
                console.log('[POLL] Reboot command executed successfully:', stdout)
              }
            })
          } else if (type === 'contacts_updated') {
            console.log('[POLL] Contacts updated notification received. Syncing contacts...')
            const baseUrl = (services.backend_base_url || 'https://portal.co-bien.eu').replace(/\/$/, '')
            import('./contactsService').then(({ syncContacts }) => {
              syncContacts(deviceId, apiKey, baseUrl)
                .then(() => {
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('contacts:updated');
                  }
                })
                .catch(err => console.error('[POLL] Failed to sync contacts on notification:', err))
            }).catch(err => console.error('[POLL] Failed to dynamically import contactsService:', err))
          } else if (type === 'icso_reset') {
            console.log('[POLL] ICSO reset notification received. Resetting local telemetry...')
            import('./icsoService').then(({ resetLocalTelemetry, syncIcsoToBackend }) => {
              resetLocalTelemetry()
              syncIcsoToBackend(configPath, localConfigPath, true)
            }).catch(err => console.error('[POLL] Failed to reset local telemetry:', err))
          }
        })

        if (reloadEvents) {
          console.log('[POLL] Event notification received. Refreshing local events cache...')
          import('./eventsMongo').then(({ getEvents }) => {
            getEvents(configPath).catch(err => console.error('[POLL] Failed to background-refresh events:', err))
          }).catch(err => console.error('[POLL] Failed to dynamically import eventsMongo:', err))
        }
      }
    }
  } catch(e) {
    // Silent fail for polling to avoid spamming the console too much
  }
}

