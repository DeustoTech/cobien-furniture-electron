import { app } from 'electron'
import { join } from 'node:path'
import { promises as fs } from 'node:fs'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'

const CACHE_DIR_NAME = 'board_cache'

async function getCacheDir() {
  const userData = app.getPath('userData')
  const dir = join(userData, CACHE_DIR_NAME)
  try {
    await fs.access(dir)
  } catch {
    await fs.mkdir(dir, { recursive: true })
  }
  return dir
}

async function downloadAndCacheImage(url: string, prefix: string, id: string): Promise<string> {
  if (!url) return ''
  
  try {
    const dir = await getCacheDir()
    // naive extension grab
    let ext = '.png'
    if (url.includes('.jpg') || url.includes('.jpeg')) ext = '.jpg'
    
    const fileName = `${prefix}_${id}${ext}`
    const targetPath = join(dir, fileName)
    
    // check if it already exists
    try {
      await fs.access(targetPath)
      return `file://${targetPath}`
    } catch {
      // file doesn't exist, proceed to download
    }

    const headers: Record<string, string> = {}
    if (process.env.COBIEN_NOTIFY_API_KEY) {
      headers['X-API-KEY'] = process.env.COBIEN_NOTIFY_API_KEY
    }

    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`)
    
    // we use node streams to pipe the body straight to file
    const fileStream = createWriteStream(targetPath)
    if (res.body) {
      // The web fetch API body is a ReadableStream which can be piped to Node stream
      // We need to convert it using an async iterator or just buffer it since images are small
      const arrayBuffer = await res.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      await fs.writeFile(targetPath, buffer)
      return `file://${targetPath}`
    }
    return ''
  } catch(e) {
    console.error(`[BOARD] Failed to cache image ${url}:`, e)
    return '' // fail silently and return no image
  }
}

export async function fetchMessages() {
  const deviceId = process.env.COBIEN_DEVICE_ID || 'CoBien6'
  const baseUrl = process.env.COBIEN_BACKEND_BASE_URL || 'https://portal.co-bien.eu'
  const url = `${baseUrl}/pizarra/api/messages/?recipient=${deviceId}`
  
  const headers: Record<string, string> = {}
  if (process.env.COBIEN_NOTIFY_API_KEY) {
    headers['X-API-KEY'] = process.env.COBIEN_NOTIFY_API_KEY
  }

  try {
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`API returned ${res.statusText}`)
    
    const data = await res.json()
    const messages = data.messages || []
    
    // Process messages and cache images
    const processedMessages = await Promise.all(messages.map(async (msg: any) => {
      let imagePath = ''
      let avatarPath = ''
      
      if (msg.image || msg.image_url) {
        imagePath = await downloadAndCacheImage(msg.image || msg.image_url, 'img', msg.id)
      }
      
      if (msg.author_avatar_url) {
        avatarPath = await downloadAndCacheImage(msg.author_avatar_url, 'avatar', msg.id)
      }

      return {
        id: msg.id,
        author: msg.author_name || msg.author || '—',
        author_avatar: avatarPath,
        text: msg.text || '',
        image: imagePath,
        created_at_human: msg.created_at_human || '',
        read_by: (msg.read_by || []).map((r: any) => r.device_id),
        quick_replies: msg.quick_replies || [],
        quick_reply_selected: msg.quick_reply_selected || null
      }
    }))
    
    return processedMessages
  } catch(e) {
    console.error('[BOARD] Failed to fetch messages:', e)
    return []
  }
}

export async function deleteMessage(id: string) {
  const baseUrl = process.env.COBIEN_BACKEND_BASE_URL || 'https://portal.co-bien.eu'
  const url = `${baseUrl}/pizarra/api/messages/${id}/delete/`
  
  const headers: Record<string, string> = {}
  if (process.env.COBIEN_NOTIFY_API_KEY) {
    headers['X-API-KEY'] = process.env.COBIEN_NOTIFY_API_KEY
  }
  
  try {
    const res = await fetch(url, { method: 'POST', headers })
    return res.ok
  } catch(e) {
    console.error('[BOARD] Failed to delete message:', e)
    return false
  }
}

export async function markMessageRead(id: string) {
  const deviceId = process.env.COBIEN_DEVICE_ID || 'CoBien6'
  const baseUrl = process.env.COBIEN_BACKEND_BASE_URL || 'https://portal.co-bien.eu'
  const url = `${baseUrl}/pizarra/api/messages/${id}/read/`
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.COBIEN_NOTIFY_API_KEY) {
    headers['X-API-KEY'] = process.env.COBIEN_NOTIFY_API_KEY
  }
  
  try {
    const res = await fetch(url, { 
      method: 'POST', 
      headers,
      body: JSON.stringify({ device_id: deviceId })
    })
    return res.ok
  } catch(e) {
    console.error('[BOARD] Failed to mark message read:', e)
    return false
  }
}

export async function submitQuickReply(id: string, replyText: string) {
  const deviceId = process.env.COBIEN_DEVICE_ID || 'CoBien6'
  const baseUrl = process.env.COBIEN_BACKEND_BASE_URL || 'https://portal.co-bien.eu'
  const url = `${baseUrl}/pizarra/api/messages/${id}/reply/`
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.COBIEN_NOTIFY_API_KEY) {
    headers['X-API-KEY'] = process.env.COBIEN_NOTIFY_API_KEY
  }
  
  try {
    const res = await fetch(url, { 
      method: 'POST', 
      headers,
      body: JSON.stringify({ device_id: deviceId, reply_text: replyText })
    })
    return res.ok
  } catch(e) {
    console.error('[BOARD] Failed to submit reply:', e)
    return false
  }
}
