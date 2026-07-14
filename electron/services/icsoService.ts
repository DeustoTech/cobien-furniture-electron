import { app } from 'electron'
import { join } from 'node:path'
import * as fs from 'node:fs'
import { promises as fsPromises } from 'node:fs'

const logDir = join(app.getPath('userData'), 'logs')
const LOG_TXT = join(logDir, 'icso_log.txt')
const LOG_JSON = join(logDir, 'icso_log.json')
const LOG_PROXIMITY_TXT = join(logDir, 'icso_proximity_sensors.txt')
const SYNC_STATE_PATH = join(app.getPath('userData'), 'icso_sync_state.json')

export interface IcsoState {
  page_views: {
    weather: number
    events: number
    day_events: number
    contacts: number
    board: number
  }
  navigation_inputs: {
    touchscreen: number
    home_button: number
    vocal_assistant: number
    rfid_cards: number
  }
  imu: {
    state: string
    movements: number
  }
  video_calls: {
    call_requests: number
    calls_made: number
    last_duration_sec: number
    total_duration_sec: number
  }
  board: {
    received_photos: number
  }
  events: {
    added_events: number
  }
  screen_wakeup: {
    wakeups: number
  }
  proximity: Record<string, { motion_detected: number; approach_detected: number }>
}

const DEFAULT_STATE: IcsoState = {
  page_views: { weather: 0, events: 0, day_events: 0, contacts: 0, board: 0 },
  navigation_inputs: { touchscreen: 0, home_button: 0, vocal_assistant: 0, rfid_cards: 0 },
  imu: { state: 'idle', movements: 0 },
  video_calls: { call_requests: 0, calls_made: 0, last_duration_sec: 0, total_duration_sec: 0 },
  board: { received_photos: 0 },
  events: { added_events: 0 },
  screen_wakeup: { wakeups: 0 },
  proximity: {
    north: { motion_detected: 0, approach_detected: 0 },
    south: { motion_detected: 0, approach_detected: 0 },
    east: { motion_detected: 0, approach_detected: 0 },
    west: { motion_detected: 0, approach_detected: 0 }
  }
}

// Proximity event codes
const EVENT_MOTION_START = 0x5EBA
const EVENT_APPROACH = 0xD157
const EVENT_MOTION_END = 0xE5AB

const SENSOR_MAP: Record<number, string> = {
  0x475: "north",
  0x474: "south",
  0x476: "east",
  0x477: "west",
}

const LABEL_MAP: Record<string, string> = {
  "north": "NORTH",
  "south": "SOUTH",
  "east": "EAST",
  "west": "WEST",
}

let syncTimer: NodeJS.Timeout | null = null

function ensureLogsDir() {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }
}

function loadState(): IcsoState {
  ensureLogsDir()
  if (!fs.existsSync(LOG_JSON)) {
    return JSON.parse(JSON.stringify(DEFAULT_STATE))
  }
  try {
    const raw = fs.readFileSync(LOG_JSON, 'utf-8')
    const parsed = JSON.parse(raw)
    // Deep merge to make sure no keys are missing
    return {
      page_views: { ...DEFAULT_STATE.page_views, ...parsed.page_views },
      navigation_inputs: { ...DEFAULT_STATE.navigation_inputs, ...parsed.navigation_inputs },
      imu: { ...DEFAULT_STATE.imu, ...parsed.imu },
      video_calls: { ...DEFAULT_STATE.video_calls, ...parsed.video_calls },
      board: { ...DEFAULT_STATE.board, ...parsed.board },
      events: { ...DEFAULT_STATE.events, ...parsed.events },
      screen_wakeup: { ...DEFAULT_STATE.screen_wakeup, ...parsed.screen_wakeup },
      proximity: {
        north: { ...DEFAULT_STATE.proximity.north, ...parsed.proximity?.north },
        south: { ...DEFAULT_STATE.proximity.south, ...parsed.proximity?.south },
        east: { ...DEFAULT_STATE.proximity.east, ...parsed.proximity?.east },
        west: { ...DEFAULT_STATE.proximity.west, ...parsed.proximity?.west }
      }
    }
  } catch (e) {
    console.error('[ICSO] Failed to load JSON state, falling back to defaults:', e)
    return JSON.parse(JSON.stringify(DEFAULT_STATE))
  }
}

function saveState(state: IcsoState) {
  ensureLogsDir()
  try {
    fs.writeFileSync(LOG_JSON, JSON.stringify(state, null, 4), 'utf-8')
  } catch (e) {
    console.error('[ICSO] Failed to save JSON state:', e)
  }
}

function getFormattedTime(): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function ensureLogSizeLimit(filePath: string, maxSizeBytes = 5 * 1024 * 1024) {
  try {
    if (!fs.existsSync(filePath)) return
    const stat = fs.statSync(filePath)
    if (stat.size > maxSizeBytes) {
      const backupPath = filePath + '.1'
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath)
      }
      fs.renameSync(filePath, backupPath)
    }
  } catch (e) {
    console.error(`[ICSO] Log rotation failed for ${filePath}:`, e)
  }
}

export function writeTxtLog(source: string, target?: string, recognized?: string) {
  ensureLogsDir()
  const now = getFormattedTime()
  const labelMap: Record<string, string> = {
    touchscreen: "TOUCHSCREEN",
    home_button: "HOME BUTTON",
    vocal_assistant: "VOCAL ASSISTANT",
    rfid_cards: "RFID CARD",
    imu: "IMU",
    videocall: "VIDEO CALL",
    notification: "NOTIFICATION",
    wakeup: "SCREEN WAKEUP",
    proximity: "PROXIMITY",
  }

  const sourceStr = source.trim() || "SYSTEM"
  const label = labelMap[sourceStr] || sourceStr.toUpperCase()
  let line = ''

  if (target === undefined && !labelMap[sourceStr]) {
    line = `[${now}] ${sourceStr}`
    ensureLogSizeLimit(LOG_TXT)
    fs.appendFileSync(LOG_TXT, line + '\n', 'utf-8')
    return
  }

  let finalTarget = target || ''
  if (sourceStr === 'rfid_cards' && finalTarget === 'videocall') {
    finalTarget = 'videocall request'
  }

  if (sourceStr === 'vocal_assistant' && (!finalTarget || finalTarget === 'assistant_triggered')) {
    line = `[${now}] ACTIVATION VOCAL ASSISTANT`
  } else if (sourceStr === 'vocal_assistant' && finalTarget) {
    const recog = (recognized || '').trim()
    line = recog 
      ? `[${now}] VOCAL ASSISTANT → ${finalTarget} (recognized: ${recog})`
      : `[${now}] VOCAL ASSISTANT → ${finalTarget}`
  } else if (sourceStr === 'proximity' && finalTarget) {
    line = `[${now}] PROXIMITY → ${finalTarget}`
  } else if (finalTarget) {
    line = `[${now}] VIA ${label} → ${finalTarget}`
  } else {
    line = `[${now}] ${label}`
  }

  const logPath = sourceStr === 'proximity' ? LOG_PROXIMITY_TXT : LOG_TXT
  ensureLogSizeLimit(logPath)
  fs.appendFileSync(logPath, line + '\n', 'utf-8')
}

// Global logger functions
export function logNavigation(target: string, source: 'touchscreen' | 'home_button' | 'vocal_assistant' | 'rfid_cards') {
  const state = loadState()
  
  // Update views count
  let targetClean = target.replace(/^\//, '').replace(/-/g, '_')
  if (targetClean === 'call') {
    targetClean = 'contacts'
  }
  const pageViews = state.page_views as any
  if (pageViews[targetClean] !== undefined) {
    pageViews[targetClean]++
  } else if (target === '' || target === '/') {
    // skip home view or separate view
  }

  // Update input counts
  const navInputs = state.navigation_inputs as any
  if (navInputs[source] !== undefined) {
    navInputs[source]++
  }

  saveState(state)
  writeTxtLog(source, targetClean || 'home')
}

export function logImuEvent(eventType?: 'movement_start' | 'movement_stop') {
  const state = loadState()
  const finalEvent = eventType || (state.imu.state === 'idle' ? 'movement_start' : 'movement_stop')
  state.imu.state = finalEvent === 'movement_start' ? 'moving' : 'idle'
  if (finalEvent === 'movement_stop') {
    state.imu.movements++
  }
  saveState(state)
  writeTxtLog('imu', finalEvent === 'movement_start' ? 'moving' : 'idle')
}

export function logProximityEvent(canId: number, eventCode: number) {
  if (SENSOR_MAP[canId] === undefined) return
  const position = SENSOR_MAP[canId]
  const state = loadState()

  let changed = false
  let logLabel: string | null = null

  if (eventCode === EVENT_MOTION_START) {
    state.proximity[position].motion_detected++
    changed = true
    logLabel = 'MOTION'
  } else if (eventCode === EVENT_APPROACH) {
    state.proximity[position].approach_detected++
    changed = true
    logLabel = 'APPROACH'
  } else if (eventCode === EVENT_MOTION_END) {
    logLabel = 'MOTION_END'
  }

  if (changed) {
    saveState(state)
  }

  if (logLabel !== null) {
    writeTxtLog('proximity', `${logLabel} ${LABEL_MAP[position]}`)
  }
}

export function logVideoCallEvent(eventType: 'request' | 'made' | 'ended', durationSec = 0) {
  const state = loadState()
  if (eventType === 'request') {
    state.video_calls.call_requests++
  } else if (eventType === 'made') {
    state.video_calls.calls_made++
  } else if (eventType === 'ended') {
    state.video_calls.last_duration_sec = durationSec
    state.video_calls.total_duration_sec += durationSec
  }
  saveState(state)
  writeTxtLog('videocall', eventType)
}

export function logNotificationReceived(type: 'photo' | 'event') {
  const state = loadState()
  if (type === 'photo') {
    state.board.received_photos++
  } else if (type === 'event') {
    state.events.added_events++
  }
  saveState(state)
  writeTxtLog('notification', type)
}

export function logScreenWakeup() {
  const state = loadState()
  state.screen_wakeup.wakeups++
  saveState(state)
  writeTxtLog('wakeup')
}

// Sincronización con el Backend del Portal
interface SyncState {
  txt_offset: number
  proximity_offset: number
  last_snapshot_sync_at: string
  last_events_sync_at: string
  last_error: string
}

async function readNewLines(filePath: string, prevOffset: number): Promise<{ lines: string[]; offset: number }> {
  try {
    if (!fs.existsSync(filePath)) {
      return { lines: [], offset: 0 }
    }
    const stat = await fsPromises.stat(filePath)
    let offset = prevOffset >= 0 && prevOffset <= stat.size ? prevOffset : 0

    const fd = await fsPromises.open(filePath, 'r')
    const buffer = Buffer.alloc(stat.size - offset)
    await fd.read(buffer, 0, stat.size - offset, offset)
    await fd.close()

    const chunk = buffer.toString('utf-8')
    const lines = chunk.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    return { lines, offset: stat.size }
  } catch (e) {
    console.error('[ICSO] Failed to read lines from', filePath, e)
    return { lines: [], offset: prevOffset }
  }
}

function parseTimestampFromLine(line: string): string {
  if (!line.startsWith('[')) return ''
  const closing = line.indexOf(']')
  if (closing <= 1) return ''
  const raw = line.substring(1, closing).trim()
  try {
    // Reformat YYYY-MM-DD HH:MM:SS to ISO string
    const parts = raw.split(' ')
    const dateParts = parts[0].split('-')
    const timeParts = parts[1].split(':')
    const d = new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2]),
      parseInt(timeParts[0]),
      parseInt(timeParts[1]),
      parseInt(timeParts[2])
    )
    return d.toISOString()
  } catch (e) {
    return ''
  }
}

export async function syncIcsoToBackend(configPath: string, localConfigPath: string, forceSnapshot = false) {
  // Load configuration
  let services: any = {}
  let settings: any = {}
  try {
    const defaultData = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    let localData: any = {}
    try {
      localData = JSON.parse(fs.readFileSync(localConfigPath, 'utf-8'))
    } catch (e) {}
    services = { ...defaultData.services, ...localData.services }
    settings = { ...defaultData.settings, ...localData.settings }
  } catch (e) {
    console.error('[ICSO] Sync configuration read failed:', e)
    return
  }

  const backendBase = (services.backend_base_url || 'https://portal.co-bien.eu').replace(/\/$/, '')
  const telemetryUrl = (services.icso_telemetry_url || `${backendBase}/pizarra/api/icso/telemetry/`).trim()
  const eventsUrl = (services.icso_events_url || `${backendBase}/pizarra/api/icso/events/`).trim()
  const apiKey = process.env.COBIEN_NOTIFY_API_KEY || process.env.NOTIFY_API_KEY || services.notify_api_key || ''
  const deviceId = process.env.COBIEN_DEVICE_ID || settings.device_id || 'CoBien6'

  if (!deviceId) return
  if (!telemetryUrl || !eventsUrl) return

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (apiKey) {
    headers['X-API-KEY'] = apiKey
  }

  // Load sync state
  let syncState: SyncState = {
    txt_offset: 0,
    proximity_offset: 0,
    last_snapshot_sync_at: '',
    last_events_sync_at: '',
    last_error: ''
  }
  if (fs.existsSync(SYNC_STATE_PATH)) {
    try {
      syncState = { ...syncState, ...JSON.parse(fs.readFileSync(SYNC_STATE_PATH, 'utf-8')) }
    } catch (e) {}
  }

  const now = new Date().toISOString()

  // 1. Snapshot Telemetry Sync
  if (forceSnapshot || fs.existsSync(LOG_JSON)) {
    try {
      const snapshot = loadState()
      const payload = {
        device_id: deviceId,
        captured_at: now,
        snapshot
      }
      const res = await fetch(telemetryUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        throw new Error(`Telemetry sync HTTP ${res.status}`)
      }
      syncState.last_snapshot_sync_at = now
    } catch (err: any) {
      console.error('[ICSO] Telemetry snapshot sync failed:', err.message || err)
      syncState.last_error = `Telemetry: ${err.message || err}`
      fs.writeFileSync(SYNC_STATE_PATH, JSON.stringify(syncState, null, 4), 'utf-8')
      return
    }
  }

  // 2. Events Logs Sync
  const { lines: txtLines, offset: txtOffset } = await readNewLines(LOG_TXT, syncState.txt_offset)
  const { lines: proximityLines, offset: proximityOffset } = await readNewLines(LOG_PROXIMITY_TXT, syncState.proximity_offset)

  const events: any[] = []
  txtLines.forEach(line => {
    events.push({
      device_id: deviceId,
      source: 'icso_log',
      logged_at: parseTimestampFromLine(line) || now,
      message: line
    })
  })
  proximityLines.forEach(line => {
    events.push({
      device_id: deviceId,
      source: 'icso_proximity',
      logged_at: parseTimestampFromLine(line) || now,
      message: line
    })
  })

  if (events.length > 0) {
    try {
      const payload = {
        device_id: deviceId,
        sent_at: now,
        events
      }
      const res = await fetch(eventsUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        throw new Error(`Events sync HTTP ${res.status}`)
      }
      syncState.txt_offset = txtOffset
      syncState.proximity_offset = proximityOffset
      syncState.last_events_sync_at = now
      syncState.last_error = ''
    } catch (err: any) {
      console.error('[ICSO] Events sync failed:', err.message || err)
      syncState.last_error = `Events: ${err.message || err}`
    }
  }

  fs.writeFileSync(SYNC_STATE_PATH, JSON.stringify(syncState, null, 4), 'utf-8')
}

// Background sync loop initialization
export function startIcsoSyncLoop(configPath: string, localConfigPath: string) {
  if (syncTimer) {
    clearInterval(syncTimer)
  }
  // Run immediately and then every 5 minutes
  syncIcsoToBackend(configPath, localConfigPath, true)
  syncTimer = setInterval(() => {
    syncIcsoToBackend(configPath, localConfigPath, false)
  }, 5 * 60 * 1000)
}

export function stopIcsoSyncLoop() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

export function resetLocalTelemetry() {
  saveState(DEFAULT_STATE)
  console.log('[ICSO] Local telemetry snapshot reset to default state.')
}
