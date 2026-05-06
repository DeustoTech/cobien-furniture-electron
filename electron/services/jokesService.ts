/**
 * jokesService.ts — Load and serve random jokes from legacy cobien_FrontEnd dataset
 */
import { promises as fs } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const _dirname = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))

const JOKES_DIR = join(_dirname, '../../../cobien_FrontEnd/app/data/jokes')


let cachedJokes: string[] = []
let lastJoke: string = ''

async function loadJokes(lang: string = 'es'): Promise<string[]> {
  try {
    const file = lang === 'fr' ? 'jokes_fr.json' : 'jokes_es.json'
    const raw = await fs.readFile(join(JOKES_DIR, file), 'utf-8')
    const data = JSON.parse(raw)

    const jokes: string[] = []
    for (const catJokes of Object.values(data)) {
      if (Array.isArray(catJokes)) {
        for (const joke of catJokes) {
          if (typeof joke === 'string' && joke.trim()) {
            jokes.push(joke.trim())
          } else if (typeof joke === 'object' && joke !== null) {
            const j = joke as any
            if (j.text) jokes.push(String(j.text).trim())
            else if (j.setup && j.punchline) jokes.push(`${j.setup.trim()} — ${j.punchline.trim()}`)
          }
        }
      }
    }
    return jokes.filter(Boolean)
  } catch (e) {
    console.error('[JOKES] Error loading jokes:', e)
    return [
      '¿Qué le dice un jardinero a otro? Nos vemos cuando podamos.',
      '¿Por qué los pájaros no usan Facebook? Porque ya tienen Twitter.',
      '¿Cuál es el colmo de un electricista? Que su mujer se llame Luz.',
    ]
  }
}

export async function getRandomJoke(lang = 'es'): Promise<string> {
  if (cachedJokes.length === 0) {
    cachedJokes = await loadJokes(lang)
  }

  if (cachedJokes.length === 0) return 'No hay chistes disponibles.'

  const available = cachedJokes.length > 1
    ? cachedJokes.filter(j => j !== lastJoke)
    : cachedJokes

  const joke = available[Math.floor(Math.random() * available.length)]
  lastJoke = joke
  return joke
}
