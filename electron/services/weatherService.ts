/**
 * weatherService.ts — Real weather data via Open-Meteo + Nominatim + OWM (optional)
 *
 * Mirrors cobien_FrontEnd/app/weather/weather_data.py logic.
 * - Geocodes city name via Nominatim (free, no key needed)
 * - Fetches current + hourly + 6-day forecast from Open-Meteo (free, no key)
 * - Optionally enriches description via OpenWeatherMap if OWM_API_KEY is set
 */

interface HourlyItem {
  time: string   // e.g. "5 a.m."
  icon: string   // path to local image
  temp: string   // e.g. "8°"
}

interface DailyItem {
  name: string   // e.g. "Lunes"
  icon: string
  tmin: string
  tmax: string
  pop: number    // precipitation probability 0-100
}

interface WeatherBundle {
  city: string
  temp: string
  description: string
  icon: string
  tempMin: string
  tempMax: string
  hourly: HourlyItem[]
  daily: DailyItem[]
  error?: string
}

const WMO_ICON_MAP: Record<number, string> = {
  0: '/images/sol.png',
  1: '/images/parcial.png',
  2: '/images/parcial.png',
  3: '/images/nubes.png',
  45: '/images/neblina.png',
  48: '/images/neblina.png',
  51: '/images/lluvia.png',
  53: '/images/lluvia.png',
  55: '/images/lluvia.png',
  56: '/images/lluvia.png',
  57: '/images/lluvia.png',
  61: '/images/lluvia.png',
  63: '/images/lluvia.png',
  65: '/images/lluvia.png',
  66: '/images/lluvia.png',
  67: '/images/lluvia.png',
  71: '/images/nieve.png',
  73: '/images/nieve.png',
  75: '/images/nieve.png',
  77: '/images/nieve.png',
  80: '/images/lluvia.png',
  81: '/images/lluvia.png',
  82: '/images/lluvia.png',
  85: '/images/nieve.png',
  86: '/images/nieve.png',
  95: '/images/tormenta.png',
  96: '/images/tormenta.png',
  99: '/images/tormenta.png',
}

const WMO_DESC_ES: Record<number, string> = {
  0: 'Cielo despejado',
  1: 'Mayormente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Niebla',
  48: 'Niebla con escarcha',
  51: 'Llovizna ligera',
  53: 'Llovizna moderada',
  55: 'Llovizna densa',
  61: 'Lluvia ligera',
  63: 'Lluvia moderada',
  65: 'Lluvia intensa',
  71: 'Nevada ligera',
  73: 'Nevada moderada',
  75: 'Nevada intensa',
  80: 'Chubascos ligeros',
  81: 'Chubascos moderados',
  82: 'Chubascos fuertes',
  95: 'Tormenta',
  96: 'Tormenta con granizo',
  99: 'Tormenta con granizo fuerte',
}

const WEEKDAY_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function wmoIcon(code: number, isDay = true): string {
  if (!isDay && code <= 1) return '/images/noche.png'
  return WMO_ICON_MAP[code] ?? '/images/nubes.png'
}

function wmoDesc(code: number): string {
  return WMO_DESC_ES[code] ?? 'Condición desconocida'
}

function amPmLabel(isoHour: string): string {
  const h = new Date(isoHour).getHours()
  const label = h < 12 ? 'a.m.' : 'p.m.'
  const h12 = h % 12 || 12
  return `${h12} ${label}`
}

async function geocodeCity(cityName: string): Promise<{ lat: number; lon: number; tz: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}`
    const res = await fetch(url, { headers: { 'User-Agent': 'CoBien6-Furniture' } })
    const data = await res.json()
    if (!data.length) return null
    const lat = parseFloat(data[0].lat)
    const lon = parseFloat(data[0].lon)

    const tzRes = await fetch(`https://api.open-meteo.com/v1/timezone?latitude=${lat}&longitude=${lon}`)
    const tzData = await tzRes.json()
    return { lat, lon, tz: tzData.timezone ?? 'Europe/Madrid' }
  } catch (e) {
    console.error('[WEATHER] Geocode error:', e)
    return null
  }
}

export async function fetchWeatherBundle(cityName: string): Promise<WeatherBundle> {
  const base: WeatherBundle = {
    city: cityName,
    temp: '—°',
    description: 'No disponible',
    icon: '/images/nubes.png',
    tempMin: 'Min —°',
    tempMax: 'Max —°',
    hourly: [],
    daily: [],
  }

  try {
    const geo = await geocodeCity(cityName)
    if (!geo) {
      base.error = 'Ciudad no encontrada'
      return base
    }

    const { lat, lon, tz } = geo

    // Open-Meteo: current + hourly + daily
    const omUrl = [
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`,
      `&timezone=${encodeURIComponent(tz)}`,
      `&current=temperature_2m,weathercode,is_day`,
      `&hourly=temperature_2m,weathercode`,
      `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max`,
      `&forecast_days=7`,
    ].join('')

    const omRes = await fetch(omUrl)
    const om = await omRes.json()

    // ── Current ──────────────────────────────────────
    const currentCode: number = om.current?.weathercode ?? 0
    const isDay: boolean = (om.current?.is_day ?? 1) === 1
    base.temp = `${Math.round(om.current?.temperature_2m ?? 0)}°`
    base.icon = wmoIcon(currentCode, isDay)

    // OWM description (optional)
    const owmKey = process.env.OWM_API_KEY ?? ''
    if (owmKey) {
      try {
        const owmUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${owmKey}&units=metric&lang=es`
        const owmRes = await fetch(owmUrl)
        const owm = await owmRes.json()
        base.description = owm.weather?.[0]?.description ?? wmoDesc(currentCode)
        // Capitalize first letter
        base.description = base.description.charAt(0).toUpperCase() + base.description.slice(1)
      } catch {
        base.description = wmoDesc(currentCode)
      }
    } else {
      base.description = wmoDesc(currentCode)
    }

    // ── Daily min/max for today ───────────────────────
    const todayMin = Math.round(om.daily?.temperature_2m_min?.[0] ?? 0)
    const todayMax = Math.round(om.daily?.temperature_2m_max?.[0] ?? 0)
    base.tempMin = `Min ${todayMin}°`
    base.tempMax = `Max ${todayMax}°`

    // ── Hourly (next 12 hours from now) ──────────────
    const nowHour = new Date().getHours()
    const hourlyTimes: string[] = om.hourly?.time ?? []
    const hourlyTemps: number[] = om.hourly?.temperature_2m ?? []
    const hourlyCodes: number[] = om.hourly?.weathercode ?? []

    const todayStr = new Date().toISOString().slice(0, 10)
    let startIdx = hourlyTimes.findIndex(t => t.startsWith(todayStr) && new Date(t).getHours() >= nowHour)
    if (startIdx < 0) startIdx = 0

    base.hourly = hourlyTimes.slice(startIdx, startIdx + 12).map((t, i) => {
      const h = new Date(t).getHours()
      return {
        time: amPmLabel(t),
        icon: wmoIcon(hourlyCodes[startIdx + i] ?? 0, h >= 6 && h < 20),
        temp: `${Math.round(hourlyTemps[startIdx + i] ?? 0)}°`,
      }
    })

    // ── Daily forecast (next 6 days, skip today) ─────
    const dailyTimes: string[] = om.daily?.time ?? []
    const dailyMaxArr: number[] = om.daily?.temperature_2m_max ?? []
    const dailyMinArr: number[] = om.daily?.temperature_2m_min ?? []
    const dailyCodesArr: number[] = om.daily?.weathercode ?? []
    const dailyPopArr: number[] = om.daily?.precipitation_probability_max ?? []

    base.daily = dailyTimes.slice(1, 7).map((t, i) => {
      const d = new Date(t)
      return {
        name: WEEKDAY_ES[d.getDay()],
        icon: wmoIcon(dailyCodesArr[i + 1] ?? 0),
        tmin: `${Math.round(dailyMinArr[i + 1] ?? 0)}°`,
        tmax: `${Math.round(dailyMaxArr[i + 1] ?? 0)}°`,
        pop: dailyPopArr[i + 1] ?? 0,
      }
    })

    return base
  } catch (e) {
    console.error('[WEATHER] fetchWeatherBundle error:', e)
    base.error = String(e)
    return base
  }
}
