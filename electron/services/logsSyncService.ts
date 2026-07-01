import { app } from 'electron'
import { join, basename } from 'node:path'
import * as fs from 'node:fs'
import { promises as fsPromises } from 'node:fs'

const logDir = join(app.getPath('userData'), 'logs')
const SYNC_STATE_PATH = join(app.getPath('userData'), 'logs_sync_state.json')

const MAX_BYTES_PER_FILE = 120 * 1024
const MAX_LINES_PER_FILE = 1500

const LOG_SPECS = [
  { log_type: 'app', prefix: 'cobien-app' },
  { log_type: 'can_bus', prefix: 'can-bus' },
  { log_type: 'mqtt_can_bridge', prefix: 'mqtt-can-bridge' }
]

interface LogPayload {
  log_type: string
  log_date: string
  filename: string
  content: string
  line_count: number
  byte_count: number
  truncated: boolean
  sent_at: string
}

interface SyncState {
  last_sync_at: string
  last_error: string
  files: Record<string, string>
}

let syncTimer: NodeJS.Timeout | null = null

function ensureLogsDir() {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }
}

function loadSyncState(): SyncState {
  if (!fs.existsSync(SYNC_STATE_PATH)) {
    return { last_sync_at: '', last_error: '', files: {} }
  }
  try {
    const raw = fs.readFileSync(SYNC_STATE_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      last_sync_at: parsed.last_sync_at || '',
      last_error: parsed.last_error || '',
      files: parsed.files || {}
    }
  } catch (e) {
    return { last_sync_at: '', last_error: '', files: {} }
  }
}

function saveSyncState(state: SyncState) {
  try {
    fs.writeFileSync(SYNC_STATE_PATH, JSON.stringify(state, null, 4), 'utf-8')
  } catch (e) {
    console.error('[SUPPORT LOGS] Failed to save sync state:', e)
  }
}

function getFingerprint(filePath: string): string {
  try {
    const stat = fs.statSync(filePath)
    return `${Math.floor(stat.mtimeMs)}:${stat.size}`
  } catch (e) {
    return ''
  }
}

function getTargetDates(): Date[] {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  return [today, yesterday]
}

function formatDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatDateFilenameSuffix(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

async function tailContent(filePath: string): Promise<{ content: string; line_count: number; byte_count: number; truncated: boolean }> {
  try {
    const stat = await fsPromises.stat(filePath)
    const fileSize = stat.size
    const start = Math.max(0, fileSize - MAX_BYTES_PER_FILE)

    const fd = await fsPromises.open(filePath, 'r')
    const buffer = Buffer.alloc(fileSize - start)
    await fd.read(buffer, 0, fileSize - start, start)
    await fd.close()

    let raw = buffer.toString('utf-8')
    if (start > 0) {
      const firstNewline = raw.indexOf('\n')
      if (firstNewline >= 0) {
        raw = raw.substring(firstNewline + 1)
      }
    }

    let lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    const truncated = start > 0 || lines.length > MAX_LINES_PER_FILE
    if (lines.length > MAX_LINES_PER_FILE) {
      lines = lines.slice(-MAX_LINES_PER_FILE)
    }

    const content = lines.join('\n').trim()
    return {
      content,
      line_count: lines.length,
      byte_count: fileSize,
      truncated
    }
  } catch (e) {
    return { content: '', line_count: 0, byte_count: 0, truncated: false }
  }
}

export async function syncSupportLogs(configPath: string, localConfigPath: string, force = false) {
  ensureLogsDir()

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
    console.error('[SUPPORT LOGS] Configuration read failed:', e)
    return
  }

  const backendBase = (services.backend_base_url || 'https://portal.co-bien.eu').replace(/\/$/, '')
  const logsUrl = (services.device_logs_ingest_url || `${backendBase}/pizarra/api/device/logs/ingest/`).trim()
  const apiKey = process.env.COBIEN_NOTIFY_API_KEY || process.env.NOTIFY_API_KEY || services.notify_api_key || ''
  const deviceId = process.env.COBIEN_DEVICE_ID || settings.device_id || 'CoBien6'

  if (!deviceId) return
  if (!logsUrl) return

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (apiKey) {
    headers['X-API-KEY'] = apiKey
  }

  const state = loadSyncState()
  const previousFiles = state.files || {}
  const currentFiles: Record<string, string> = { ...previousFiles }
  const logsToSync: LogPayload[] = []
  const nowStr = new Date().toISOString()
  const dates = getTargetDates()

  // Find candidate log files to upload
  for (const spec of LOG_SPECS) {
    for (const [index, dateObj] of dates.entries()) {
      const dateStr = formatDate(dateObj)
      const fileKey = `${spec.log_type}:${dateStr}`

      let targetFile = ''
      if (spec.log_type === 'app') {
        // Today reads app.log, yesterday reads app.log.1 or cobien-app-YYYYMMDD.log
        if (index === 0) {
          targetFile = join(logDir, 'app.log')
        } else {
          // Check if app.log.1 exists, else check date suffix format
          const appLog1 = join(logDir, 'app.log.1')
          if (fs.existsSync(appLog1)) {
            targetFile = appLog1
          } else {
            targetFile = join(logDir, `cobien-app-${formatDateFilenameSuffix(dateObj)}.log`)
          }
        }
      } else {
        // Look for CAN / bridge logs with date suffixes, or fallback to generic log name
        const withSuffix = join(logDir, `${spec.prefix}-${formatDateFilenameSuffix(dateObj)}.log`)
        if (fs.existsSync(withSuffix)) {
          targetFile = withSuffix
        } else {
          // If checking today, search for generic names (e.g. can.log, can_bus.log, bridge.log etc)
          if (index === 0) {
            const genericNames = spec.log_type === 'can_bus'
              ? ['can-bus.log', 'can_bus.log', 'can.log', 'can-bus.txt', 'can_bus.txt']
              : ['mqtt-can-bridge.log', 'mqtt_can_bridge.log', 'bridge.log', 'mqtt-can-bridge.txt']
            for (const name of genericNames) {
              const p = join(logDir, name)
              if (fs.existsSync(p)) {
                targetFile = p
                break
              }
            }
          }
        }
      }

      if (!targetFile || !fs.existsSync(targetFile)) {
        delete currentFiles[fileKey]
        continue
      }

      const fp = getFingerprint(targetFile)
      if (!force && previousFiles[fileKey] === fp) {
        continue
      }

      const tail = await tailContent(targetFile)
      if (tail.line_count > 0) {
        logsToSync.push({
          log_type: spec.log_type,
          log_date: dateStr,
          filename: basename(targetFile),
          content: tail.content,
          line_count: tail.line_count,
          byte_count: tail.byte_count,
          truncated: tail.truncated,
          sent_at: nowStr
        })
        currentFiles[fileKey] = fp
      }
    }
  }

  if (logsToSync.length === 0) {
    return
  }

  try {
    const res = await fetch(logsUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        device_id: deviceId,
        sent_at: nowStr,
        logs: logsToSync
      })
    })

    if (!res.ok) {
      throw new Error(`Ingest HTTP status ${res.status}`)
    }

    state.files = currentFiles
    state.last_sync_at = nowStr
    state.last_error = ''
    saveSyncState(state)
    console.log(`[SUPPORT LOGS] Successfully ingested ${logsToSync.length} support logs`)
  } catch (err: any) {
    console.error('[SUPPORT LOGS] Failed to sync support logs:', err.message || err)
    state.last_error = err.message || err
    saveSyncState(state)
  }
}

export function startLogsSyncLoop(configPath: string, localConfigPath: string) {
  if (syncTimer) {
    clearInterval(syncTimer)
  }
  // Run immediately and then every 5 minutes
  syncSupportLogs(configPath, localConfigPath, true)
  syncTimer = setInterval(() => {
    syncSupportLogs(configPath, localConfigPath, false)
  }, 5 * 60 * 1000)
}

export function stopLogsSyncLoop() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}
