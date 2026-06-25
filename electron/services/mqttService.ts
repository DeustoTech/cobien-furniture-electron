/**
 * mqttService.ts — MQTT sensor bridge for CoBien furniture
 *
 * Mirrors cobien_FrontEnd/app/mqtt_publisher.py logic:
 *
 * Topics subscribed (from hardware/broker):
 *   rfid/read       → RFID card tap → navigate/videocall/weather
 *   sensors/update  → Capacitive buttons (PIC id) → navigate to screen
 *   app/nav         → Already processed nav commands (from legacy Python bridge)
 *   events/reload   → Force events screen refresh
 *   board/reload    → Force board screen refresh
 *   weather/reload  → Force weather refresh
 *
 * All events are forwarded to the renderer via IPC: 'mqtt:event'
 * Payload shape: { topic: string, type: string, target: string, extra?: any }
 */

import mqtt, { type MqttClient } from 'mqtt'
import type { BrowserWindow } from 'electron'

const TOPIC_RFID = 'rfid/read'
const TOPIC_SENSORS = 'sensors/update'
const TOPIC_APP_NAV = 'app/nav'
const TOPIC_EVENTS_RELOAD = 'events/reload'
const TOPIC_BOARD_RELOAD = 'board/reload'
const TOPIC_WEATHER_RELOAD = 'weather/reload'

const SUBSCRIBED_TOPICS = [
  TOPIC_RFID,
  TOPIC_SENSORS,
  TOPIC_APP_NAV,
  TOPIC_EVENTS_RELOAD,
  TOPIC_BOARD_RELOAD,
  TOPIC_WEATHER_RELOAD,
]

// Capacitive button mapping — mirrors BUTTON_ACTIONS in mqtt_publisher.py
const BUTTON_ACTIONS: Record<number, { target: string; source: string }> = {
  1: { target: 'main', source: 'home_button' },
  2: { target: 'voice_cmd', source: 'vocal_assistant' },
}

interface RfidAction {
  target: string
  extra?: any
}

let rfidActions: Record<number, RfidAction> = {}

// Debounce for RFID cards (5 seconds like the legacy)
const RFID_DEBOUNCE_MS = 5000
let lastRfidId: number | null = null
let lastRfidAt = 0

let client: MqttClient | null = null
let mainWindowRef: BrowserWindow | null = null

function send(payload: object) {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return
  mainWindowRef.webContents.send('mqtt:event', payload)
}

function handleRfid(raw: any) {
  let cardId: number
  try {
    cardId = raw?.data?.id !== undefined ? parseInt(raw.data.id) : parseInt(raw.id ?? 0)
  } catch {
    cardId = 0
  }
  if (!cardId) return

  const now = Date.now()
  if (cardId === lastRfidId && now - lastRfidAt < RFID_DEBOUNCE_MS) {
    console.log(`[MQTT] RFID debounce ignored: ${cardId}`)
    return
  }
  lastRfidId = cardId
  lastRfidAt = now

  console.log(`[MQTT] RFID card: ${cardId}`)
  
  const action = rfidActions[cardId]
  if (action) {
    send({ topic: TOPIC_APP_NAV, type: 'nav', source: 'rfid', ...action })
  } else {
    send({ topic: TOPIC_RFID, type: 'rfid', cardId })
  }
}

function handleSensors(raw: any) {
  let picId: number
  try {
    picId = raw?.data?.PIC !== undefined ? parseInt(raw.data.PIC) : parseInt(raw.PIC ?? 0)
  } catch {
    picId = 0
  }
  if (!picId) return

  const action = BUTTON_ACTIONS[picId]
  if (action) {
    console.log(`[MQTT] Button PIC=${picId} → ${action.target}`)
    send({ topic: TOPIC_SENSORS, type: 'nav', target: action.target, source: action.source })
  } else {
    console.warn(`[MQTT] Unknown button PIC: ${picId}`)
  }
}

function handleAppNav(raw: any) {
  // Forward the processed nav payload directly to renderer
  send({ topic: TOPIC_APP_NAV, ...raw })
}

async function loadRfidActions() {
  const { promises: fs } = await import('node:fs')
  const { join, dirname } = await import('node:path')
  const { app } = await import('electron')
  const configPath = join(app.getPath('userData'), 'config.local.json')

  try {
    const data = JSON.parse(await fs.readFile(configPath, 'utf-8'))
    const mappings = data.settings?.rfid_actions || {}
    const newActions: Record<number, RfidAction> = {}

    for (const [idStr, payload] of Object.entries(mappings)) {
      const id = parseInt(idStr)
      if (isNaN(id)) continue

      const p = payload as any
      const action = p?.action || 'day_events'
      const extra = p?.extra || ''

      if (action === 'weather') {
        newActions[id] = { target: 'weather', extra: { name: extra } }
      } else if (action === 'videocall') {
        // We'll need to resolve contact display name to userName later or in renderer
        // For now, pass extra as name
        newActions[id] = { target: 'videocall', extra: { to_user: extra } }
      } else {
        newActions[id] = { target: 'day_events' }
      }
    }
    rfidActions = newActions
    console.log(`[MQTT] Loaded ${Object.keys(rfidActions).length} RFID actions`)
  } catch (e) {
    console.error('[MQTT] Failed to load RFID config:', e)
  }
}

export function startMqtt(win: BrowserWindow): void {
  mainWindowRef = win
  loadRfidActions()

  const broker = process.env.COBIEN_MQTT_LOCAL_BROKER || 'localhost'
  const port = parseInt(process.env.COBIEN_MQTT_LOCAL_PORT || '1883', 10)

  const url = `mqtt://${broker}:${port}`
  console.log(`[MQTT] Connecting to ${url}`)

  client = mqtt.connect(url, {
    clientId: `cobien-electron-${Date.now()}`,
    connectTimeout: 5000,
    reconnectPeriod: 10000,  // reconnect every 10s if disconnected
    clean: true,
  })

  client.on('connect', () => {
    console.log('[MQTT] Connected')
    for (const topic of SUBSCRIBED_TOPICS) {
      client!.subscribe(topic, { qos: 0 }, (err) => {
        if (err) console.error(`[MQTT] Subscribe error on ${topic}:`, err)
        else console.log(`[MQTT] Subscribed: ${topic}`)
      })
    }
    send({ topic: 'mqtt/status', type: 'status', connected: true })
  })

  client.on('message', (topic, message) => {
    let payload: any = {}
    try {
      payload = JSON.parse(message.toString())
    } catch {
      payload = {}
    }

    switch (topic) {
      case TOPIC_RFID:
        handleRfid(payload)
        break
      case TOPIC_SENSORS:
        handleSensors(payload)
        break
      case TOPIC_APP_NAV:
        handleAppNav(payload)
        break
      case TOPIC_EVENTS_RELOAD:
        send({ topic, type: 'reload', target: 'events' })
        break
      case TOPIC_BOARD_RELOAD:
        send({ topic, type: 'reload', target: 'board' })
        break
      case TOPIC_WEATHER_RELOAD:
        send({ topic, type: 'reload', target: 'weather' })
        break
      case 'rfid/actions_reload':
        loadRfidActions()
        break
      default:
        console.log(`[MQTT] Unhandled topic: ${topic}`)
    }
  })

  client.on('error', (err) => {
    console.warn('[MQTT] Error:', err.message)
    send({ topic: 'mqtt/status', type: 'status', connected: false, error: err.message })
  })

  client.on('offline', () => {
    console.warn('[MQTT] Offline — will retry')
    send({ topic: 'mqtt/status', type: 'status', connected: false })
  })

  client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting...')
  })
}

export function stopMqtt(): void {
  if (client) {
    client.end(true)
    client = null
    console.log('[MQTT] Disconnected')
  }
}

const SHAPES: Record<string, number> = {
  "all": 0,
  "square": 1,
  "diamond": 2,
  "plus": 3,
  "X": 4,
  "only_center": 5
}

const MODES: Record<string, number> = {
  "on": 0,
  "off": 1,
  "blink": 2,
  "fading_blink": 3
}

export function encodeShapeMode(shape: string, mode: string): number {
  const shapeCode = SHAPES[shape] ?? 0
  const modeCode = MODES[mode] ?? 0
  return (shapeCode << 4) | modeCode
}

export function publishButtonConfig(buttonColors: any) {
  if (!client || !client.connected) {
    console.warn('[MQTT] Client not connected, cannot publish button config')
    return
  }

  // Publish PIC1
  if (buttonColors.PIC1) {
    const pic1 = buttonColors.PIC1
    const shapeMode1 = encodeShapeMode(pic1.shape || 'all', pic1.mode || 'on')
    const payload1 = {
      PIC: 0x01,
      shape_mode: shapeMode1,
      color: pic1.color || '#ffffff',
      intensity: pic1.intensity !== undefined ? parseInt(pic1.intensity, 10) : 255
    }
    client.publish('button/config', JSON.stringify(payload1))
    console.log('[MQTT] Published button config for PIC1:', payload1)
  }

  // Publish PIC2
  if (buttonColors.PIC2) {
    const pic2 = buttonColors.PIC2
    const shapeMode2 = encodeShapeMode(pic2.shape || 'all', pic2.mode || 'on')
    const payload2 = {
      PIC: 0x02,
      shape_mode: shapeMode2,
      color: pic2.color || '#ffffff',
      intensity: pic2.intensity !== undefined ? parseInt(pic2.intensity, 10) : 255
    }
    client.publish('button/config', JSON.stringify(payload2))
    console.log('[MQTT] Published button config for PIC2:', payload2)
  }
}

