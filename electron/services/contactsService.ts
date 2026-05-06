/**
 * contactsService.ts — Load contacts from legacy list_contacts.txt
 * and send videocall notifications via portal API.
 */
import { promises as fs } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as fsSync from 'node:fs'

const _dirname = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))

const CONTACTS_DIR = join(_dirname, '../../../../cobien_FrontEnd/app/contacts')
const CONTACTS_FILE = join(CONTACTS_DIR, 'list_contacts.txt')
const DEFAULT_IMG = join(CONTACTS_DIR, 'default_user.png')

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function findContactImage(displayName: string): string {
  const base = normalizeName(displayName)
  const exts = ['.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.JPEG']
  for (const ext of exts) {
    const p = join(CONTACTS_DIR, base + ext)
    if (fsSync.existsSync(p)) return p
  }
  return DEFAULT_IMG
}

export interface Contact {
  displayName: string
  userName: string
  imagePath: string
  callable: boolean
}

export async function loadContacts(): Promise<Contact[]> {
  const contacts: Contact[] = []
  try {
    const raw = await fs.readFile(CONTACTS_FILE, 'utf-8')
    for (const line of raw.split('\n')) {
      if (!line.includes('=')) continue
      const [displayName, userName] = line.split('=', 2).map(s => s.trim())
      if (!displayName) continue

      const callable = /^[A-Za-z0-9_.-]+$/.test(userName ?? '')
      const imagePath = findContactImage(displayName)

      contacts.push({ displayName, userName: userName ?? '', imagePath, callable })
    }
  } catch (e) {
    console.error('[CONTACTS] Error loading contacts:', e)
  }
  return contacts
}

export async function requestCall(
  userName: string,
  deviceId: string,
  apiKey: string,
  baseUrl: string
): Promise<{ ok: boolean; code?: string; detail?: string }> {
  if (!userName || !/^[A-Za-z0-9_.-]+$/.test(userName)) {
    return { ok: false, code: 'VC-USER', detail: 'Nombre de usuario inválido' }
  }
  if (!apiKey) return { ok: false, code: 'VC-CONFIG', detail: 'API key no configurada' }
  if (!deviceId) return { ok: false, code: 'VC-DEVICE', detail: 'Device ID no configurado' }

  try {
    const url = `${baseUrl}/pizarra/api/notify/`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        type: 'videollamada',
        destination: userName,
        origin: deviceId,
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return { ok: false, code: `VC-${res.status}`, detail: await res.text() }
    }
    return { ok: true }
  } catch (e: any) {
    if (e?.name === 'TimeoutError') return { ok: false, code: 'VC-TIMEOUT', detail: 'Tiempo de espera agotado' }
    if (e?.code === 'ECONNREFUSED') return { ok: false, code: 'VC-NET', detail: 'No hay conexión' }
    return { ok: false, code: 'VC-UNK', detail: String(e) }
  }
}
