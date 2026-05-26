import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as fsSync from 'node:fs'

const _dirname = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))

const CONTACTS_DIR = join(app.getPath('userData'), 'contacts')
const CONTACTS_FILE = join(CONTACTS_DIR, 'list_contacts.txt')
const DEFAULT_IMG = join(_dirname, '../public/images/default_user.png')

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

async function downloadImage(url: string, baseName: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'X-Api-Key': apiKey },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null

    const contentType = res.headers.get('Content-Type') || ''
    let ext = '.jpg'
    if (contentType.includes('png')) ext = '.png'
    else if (contentType.includes('webp')) ext = '.webp'
    else if (contentType.includes('gif')) ext = '.gif'

    const fileName = baseName + ext
    const filePath = join(CONTACTS_DIR, fileName)
    
    const buffer = await res.arrayBuffer()
    await fs.writeFile(filePath, Buffer.from(buffer))
    return fileName
  } catch (e) {
    console.error(`[CONTACTS] Failed to download image ${url}:`, e)
    return null
  }
}

export async function syncContacts(
  deviceId: string,
  apiKey: string,
  baseUrl: string
): Promise<{ count: number; images: number }> {
  try {
    if (!fsSync.existsSync(CONTACTS_DIR)) {
      fsSync.mkdirSync(CONTACTS_DIR, { recursive: true })
    }

    const url = `${rstrip(baseUrl, '/')}/pizarra/api/contacts/?device_id=${deviceId}`

    const res = await fetch(url, {
      headers: { 'X-Api-Key': apiKey },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) throw new Error(`API returned ${res.status}`)

    const data = await res.json()
    const rawContacts = Array.isArray(data) ? data : (data.contacts || [])
    
    const mapped: { display: string; user: string }[] = []
    let imagesDownloaded = 0

    for (const raw of rawContacts) {
      const displayName = (raw.display_name || raw.name || '').trim()
      const userName = (raw.user_name || raw.username || '').trim()
      const imageUrl = (raw.image_url || raw.image || '').trim()

      if (!displayName || !userName) continue

      mapped.push({ display: displayName, user: userName })

      if (imageUrl) {
        let fullUrl = imageUrl
        if (imageUrl.startsWith('/')) {
          fullUrl = rstrip(baseUrl, '/') + '/' + lstrip(imageUrl, '/')

        }
        const downloaded = await downloadImage(fullUrl, normalizeName(displayName), apiKey)
        if (downloaded) imagesDownloaded++
      }
    }

    // Update list_contacts.txt
    const content = mapped.map(c => `${c.display}=${c.user}`).join('\n') + '\n'
    await fs.writeFile(CONTACTS_FILE, content)

    console.log(`[CONTACTS] Sync complete. ${mapped.length} contacts, ${imagesDownloaded} images.`)
    return { count: mapped.length, images: imagesDownloaded }
  } catch (e) {
    console.error('[CONTACTS] Sync failed:', e)
    return { count: 0, images: 0 }
  }
}

function rstrip(str: string, chars: string): string {
  let res = str
  while (res.endsWith(chars)) res = res.slice(0, -chars.length)
  return res
}

function lstrip(str: string, chars: string): string {
  let res = str
  while (res.startsWith(chars)) res = res.slice(chars.length)
  return res
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
    const url = `${rstrip(baseUrl, '/')}/pizarra/api/notify/`

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
