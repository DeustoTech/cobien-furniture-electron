import { MongoClient } from 'mongodb'
import { promises as fs } from 'fs'

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
    const locationName = defaultData.settings?.device_location || 'Bilbao'
    
    const client = await getClient()
    const db = client.db('LabasAppDB')
    const collection = db.collection('eventos')

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
            { target_device: 'CoBien6' },
            { target_devices: 'CoBien6' }
          ]
        }
      ]
    }

    const rawEvents = await collection.find(query).toArray()
    
    const normalizedLocation = locationName.trim().toLowerCase()
    
    const events = rawEvents.map(event => {
      let audience = event.audience || 'all'
      if (typeof audience === 'string' && audience.toLowerCase() === 'device') audience = 'device'
      else audience = 'all'

      let color = audience === 'device' ? '#FF3B30' : '#1E90FF'
      if (event.color) color = event.color
      
      let loc = (event.location || '').trim()
      
      // Filter out public events that have a specific location which is not ours
      if (audience === 'all' && loc && loc.toLowerCase() !== normalizedLocation) {
        return null
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
