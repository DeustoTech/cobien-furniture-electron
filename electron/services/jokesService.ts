/**
 * jokesService.ts — Load and serve random jokes from legacy cobien_FrontEnd dataset
 */
import { promises as fs } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const _dirname = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))

const JOKES_DIR = join(_dirname, '../public/data/jokes')


let cachedJokes: Record<string, string[]> = {}
let lastJokes: Record<string, string> = {}

async function loadJokes(lang: string = 'es'): Promise<string[]> {
  try {
    const file = lang === 'fr' ? 'jokes_fr.json' : lang === 'en' ? 'jokes_en.json' : 'jokes_es.json'
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
    if (lang === 'en') {
      return [
        "Why don't scientists trust atoms? Because they make up everything!",
        "What do you call a fake noodle? An Impasta.",
        "Why did the scarecrow win an award? Because he was outstanding in his field."
      ]
    }
    return [
      '¿Qué le dice un jardinero a otro? Nos vemos cuando podamos.',
      '¿Por qué los pájaros no usan Facebook? Porque ya tienen Twitter.',
      '¿Cuál es el colmo de un electricista? Que su mujer se llame Luz.',
    ]
  }
}

export async function getRandomJoke(lang = 'es'): Promise<string> {
  const normLang = ['es', 'en', 'fr'].includes(lang) ? lang : 'es'
  if (!cachedJokes[normLang] || cachedJokes[normLang].length === 0) {
    cachedJokes[normLang] = await loadJokes(normLang)
  }

  const jokes = cachedJokes[normLang]
  if (jokes.length === 0) {
    return normLang === 'en' ? 'No jokes available.' : normLang === 'fr' ? 'Aucune blague disponible.' : 'No hay chistes disponibles.'
  }

  const lastJoke = lastJokes[normLang] || ''
  const available = jokes.length > 1
    ? jokes.filter(j => j !== lastJoke)
    : jokes

  const joke = available[Math.floor(Math.random() * available.length)]
  lastJokes[normLang] = joke
  return joke
}
