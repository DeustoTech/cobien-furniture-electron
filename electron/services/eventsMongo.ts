import { MongoClient, ObjectId } from 'mongodb'
import { promises as fs } from 'node:fs'

let cachedClient: MongoClient | null = null

async function getClient() {
  if (cachedClient) return cachedClient
  const uri = process.env.MONGO_URI || ''
  if (!uri) throw new Error('MONGO_URI is missing')
  cachedClient = new MongoClient(uri)
  await cachedClient.connect()
  return cachedClient
}

export async function getEvents(configPath: string) {
  try {
    const defaultData = JSON.parse(await fs.readFile(configPath, 'utf-8'))
    const deviceId = process.env.COBIEN_DEVICE_ID || defaultData.settings?.device_id || 'CoBien6'
    
    const client = await getClient()
    const db = client.db('LabasAppDB')
    const collection = db.collection('eventos')

    // Fetch device configuration from DB to respect region-aware scope settings
    const deviceDoc = await db.collection('devices').findOne({ device_id: deviceId }) || {}
    const visibilityScope = String(deviceDoc.event_visibility_scope || 'all').trim().toLowerCase()
    
    let eventRegions: string[] = []
    const rawRegions = deviceDoc.event_regions || []
    if (typeof rawRegions === 'string') {
      eventRegions = rawRegions.split(/\r?\n/).map((r: string) => r.trim().toLowerCase()).filter(Boolean)
    } else if (Array.isArray(rawRegions)) {
      eventRegions = rawRegions.map((r: any) => String(r).trim().toLowerCase()).filter(Boolean)
    }

    const locationName = process.env.COBIEN_DEVICE_LOCATION || deviceDoc.location || defaultData.settings?.device_location || 'Bilbao'

    const query = {
      $or: [
        { 
          $or: [
            { audience: 'all' },
            { audience: { $exists: false } },
            { audience: null }
          ]
        },
        { 
          audience: 'device', 
          $or: [
            { target_device: deviceId },
            { target_devices: deviceId }
          ]
        }
      ]
    }

    const rawEvents = await collection.find(query).toArray()
    
    const normalizedLocation = locationName.trim().toLowerCase()
    
    const events = rawEvents.map(event => {
      let audience = event.audience || 'all'
      if (typeof audience === 'string' && audience.toLowerCase() === 'device') audience = 'device'
      else audience = 'public' // Map public/all to 'public' for frontend compatibility

      let color = audience === 'device' ? '#FF3B30' : '#1E90FF'
      if (event.color) color = event.color
      
      let loc = (event.location || '').trim()
      
      // Filter out public events based on region/location visibility scope
      if (audience === 'public' && loc) {
        const locLower = loc.toLowerCase()
        
        let visible = false
        if (locLower === normalizedLocation) {
          visible = true
        } else if (visibilityScope === 'region') {
          const allowed = eventRegions.length > 0 ? eventRegions : (normalizedLocation ? [normalizedLocation] : [])
          visible = allowed.includes(locLower)
        } else {
          // visibilityScope === 'all': show everything
          visible = true
        }
        
        if (!visible) {
          return null
        }
      }

      // Convert date format correctly
      let dateStr = event.date || event.fecha_inicio || ''
      if (dateStr instanceof Date) {
        // Convert JS Date to DD-MM-YYYY
        const d = dateStr as Date
        dateStr = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`
      }

      return {
        id: event._id.toString(),
        date: dateStr,
        title: event.title || event.titulo || 'Sin título',
        description: event.description || event.descripcion || 'Sin descripción',
        location: loc || locationName,
        audience: audience,
        color: color,
        target_device: event.target_device || '',
        created_by: event.created_by || '',
        all_day: event.all_day !== false,
        start_time: event.start_time || '',
        end_time: event.end_time || ''
      }
    }).filter(e => e !== null)

    return events
  } catch(e) {
    console.error('[EVENTS] Error fetching from MongoDB:', e)
    return []
  }
}

export async function addPersonalEvent(payload: {
  date: string      // DD-MM-YYYY
  title: string
  description: string
  deviceId: string
  location: string
}) {
  try {
    const client = await getClient()
    const db = client.db('LabasAppDB')
    const collection = db.collection('eventos')

    // Convert DD-MM-YYYY to a JS Date for the stored field
    const [day, month, year] = payload.date.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)
    
    if (isNaN(dateObj.getTime())) {
      console.error('[EVENTS] Invalid date provided:', payload.date)
      return false
    }

    const doc = {
      _id: new ObjectId(),
      title: payload.title,
      description: payload.description,
      date: payload.date,
      fecha_inicio: dateObj,
      audience: 'device',
      target_device: payload.deviceId,
      target_devices: [payload.deviceId],
      location: payload.location,
      all_day: true,
      created_by: payload.deviceId,
      created_at: new Date()
    }

    await collection.insertOne(doc)
    console.log(`[EVENTS] Personal event added: ${payload.title} on ${payload.date}`)
    return true
  } catch(e: any) {
    console.error('[EVENTS] Error adding personal event:', e.message || e)
    if (e.stack) console.error(e.stack)
    return false
  }
}

export async function updatePersonalEvent(payload: {
  id: string
  title: string
  description: string
  location: string
}) {
  try {
    const client = await getClient()
    const db = client.db('LabasAppDB')
    const collection = db.collection('eventos')

    const result = await collection.updateOne(
      { _id: new ObjectId(payload.id) },
      {
        $set: {
          title: payload.title,
          description: payload.description,
          location: payload.location
        }
      }
    )
    console.log(`[EVENTS] Personal event updated: ${payload.id}`)
    return result.modifiedCount > 0
  } catch(e: any) {
    console.error('[EVENTS] Error updating personal event:', e.message || e)
    if (e.stack) console.error(e.stack)
    return false
  }
}


export async function deleteEvent(id: string) {
  try {
    const client = await getClient()
    const db = client.db('LabasAppDB')
    const collection = db.collection('eventos')
    
    const result = await collection.deleteOne({ _id: new ObjectId(id) })
    return result.deletedCount > 0
  } catch (e) {
    console.error('[EVENTS] Error deleting event:', e)
    return false
  }
}
