import { BrowserWindow, ipcMain } from 'electron'
import { promises as fs } from 'node:fs'

let currentScreen = 'home'

export async function startBackendSync(mainWindow: BrowserWindow, configPath: string, localConfigPath: string) {
  // Listen for route changes from Vue Router
  ipcMain.handle('app:route-changed', (event, routeName: string) => {
    currentScreen = routeName
  })

  // Start background intervals
  setInterval(() => sendHeartbeat(configPath, localConfigPath), 60000)
  setInterval(() => pollNotifications(mainWindow, configPath, localConfigPath), 5000)

  // Fire immediately on start
  sendHeartbeat(configPath, localConfigPath)
  pollNotifications(mainWindow, configPath, localConfigPath)
}

async function getConfig(configPath: string, localConfigPath: string) {
  try {
    const defaultData = JSON.parse(await fs.readFile(configPath, 'utf-8'))
    let localData = {}
    try {
      localData = JSON.parse(await fs.readFile(localConfigPath, 'utf-8'))
    } catch(e) {}
    
    return { ...defaultData.services, ...localData.services }
  } catch(e) {
    return {}
  }
}

async function sendHeartbeat(configPath: string, localConfigPath: string) {
  const services = await getConfig(configPath, localConfigPath)
  const url = services.device_heartbeat_url || 'https://portal.co-bien.eu/pizarra/api/devices/heartbeat/'
  const apiKey = process.env.NOTIFY_API_KEY || services.notify_api_key || ''

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey
      },
      body: JSON.stringify({
        device_id: process.env.COBIEN_DEVICE_ID || 'CoBien6',
        screen: currentScreen,
        sent_at: new Date().toISOString(),
        software_version: 'Electron-v1.0'
      })
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
  const services = await getConfig(configPath, localConfigPath)
  const url = services.device_poll_url || 'https://portal.co-bien.eu/pizarra/api/device/poll/'
  const apiKey = process.env.NOTIFY_API_KEY || services.notify_api_key || ''

  try {
    const deviceId = process.env.COBIEN_DEVICE_ID || 'CoBien6'
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
        notifications.forEach((notif: any) => {
          mainWindow.webContents.send('backend:notification', notif)
        })
      }
    }
  } catch(e) {
    // Silent fail for polling to avoid spamming the console too much
  }
}
