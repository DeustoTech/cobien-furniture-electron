/**
 * remindersService.ts — Persistent reminder scheduling
 * Mirrors cobien_FrontEnd/app/reminders/reminders.py
 */
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

interface ReminderEntry {
  id: string
  message: string
  datetime: string  // ISO 8601
}

let _dataPath: string | null = null
const timers = new Map<string, ReturnType<typeof setTimeout>>()

type NotifyCallback = (reminder: ReminderEntry) => void
let notifyCallback: NotifyCallback | null = null

function getDataPath(): string {
  if (!_dataPath) {
    _dataPath = join(app.getPath('userData'), 'reminders.json')
  }
  return _dataPath
}

async function readAll(): Promise<ReminderEntry[]> {
  try {
    const raw = await fs.readFile(getDataPath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function writeAll(reminders: ReminderEntry[]): Promise<void> {
  await fs.writeFile(getDataPath(), JSON.stringify(reminders, null, 2), 'utf-8')
}

function schedule(reminder: ReminderEntry): void {
  const ms = new Date(reminder.datetime).getTime() - Date.now()
  if (ms <= 0) return  // already past

  const t = setTimeout(async () => {
    timers.delete(reminder.id)
    notifyCallback?.(reminder)
    // Delete from storage
    const all = await readAll()
    await writeAll(all.filter(r => r.id !== reminder.id))
  }, ms)

  timers.set(reminder.id, t)
}

export async function loadPendingReminders(onFire: NotifyCallback): Promise<void> {
  notifyCallback = onFire
  const all = await readAll()
  const now = new Date()
  const pending: ReminderEntry[] = []

  for (const r of all) {
    if (new Date(r.datetime) > now) {
      schedule(r)
      pending.push(r)
    }
  }
  // Clean up expired ones
  await writeAll(pending)
  console.log(`[REMINDERS] ${pending.length} reminders scheduled`)
}

export async function addReminder(message: string, isoDatetime: string): Promise<ReminderEntry> {
  const reminder: ReminderEntry = {
    id: `rem_${Date.now()}`,
    message,
    datetime: isoDatetime,
  }
  const all = await readAll()
  all.push(reminder)
  await writeAll(all)
  schedule(reminder)
  return reminder
}

export async function listReminders(): Promise<ReminderEntry[]> {
  const all = await readAll()
  const now = new Date()
  return all.filter(r => new Date(r.datetime) > now)
}

export async function deleteReminder(id: string): Promise<boolean> {
  const all = await readAll()
  const filtered = all.filter(r => r.id !== id)
  if (filtered.length === all.length) return false
  await writeAll(filtered)
  const t = timers.get(id)
  if (t) { clearTimeout(t); timers.delete(id) }
  return true
}
