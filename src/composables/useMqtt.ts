/**
 * useMqtt.ts — Vue composable that consumes mqtt:event IPC messages
 * and maps them to router navigation and store actions.
 *
 * Topics/targets handled:
 *   type=nav, target=main          → router.push('/')
 *   type=nav, target=weather       → router.push('/weather') [+ optional city change]
 *   type=nav, target=weather_list  → (weather view handles this internally)
 *   type=nav, target=videocall     → router.push('/call')
 *   type=nav, target=day_events    → router.push('/events')
 *   type=rfid                      → forward nav from RFID card ID
 *   type=reload, target=events     → emit 'events:reload' custom event
 *   type=reload, target=board      → emit 'board:reload' custom event
 *   type=reload, target=weather    → emit 'weather:reload' custom event
 */

import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

export function useMqtt() {
  const router = useRouter()

  function handleMqttEvent(event: any) {
    const { type, target, extra } = event || {}

    console.log('[MQTT→UI]', JSON.stringify(event))

    if (type === 'nav') {
      switch (target) {
        case 'main':
          router.push('/')
          break
        case 'weather':
          router.push('/weather')
          // If extra has city info, dispatch custom event for WeatherView to pick up
          if (extra?.name) {
            window.dispatchEvent(new CustomEvent('mqtt:weather-city', { detail: extra }))
          }
          break
        case 'weather_list':
          // Let WeatherView pick this up — it may already be mounted
          window.dispatchEvent(new CustomEvent('mqtt:weather-list', { detail: extra?.cities || [] }))
          break
        case 'videocall':
          router.push('/call')
          // If a specific contact is indicated, auto-trigger the call
          if (extra?.to_user) {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('mqtt:call-contact', { detail: extra.to_user }))
            }, 500)
          }
          break
        case 'day_events':
          router.push('/events')
          break
        case 'voice_cmd':
          window.dispatchEvent(new CustomEvent('start-voice-assistant'))
          break
        default:
          console.warn('[MQTT] Unknown nav target:', target)
      }
    } else if (type === 'reload') {
      window.dispatchEvent(new CustomEvent(`mqtt:reload:${target}`))
    } else if (type === 'rfid') {
      // Raw RFID card ID — the Python bridge handles action mapping,
      // but if it's bypassed we log it for debugging
      console.log('[MQTT] Raw RFID card:', event.cardId)
    } else if (type === 'status') {
      const status = event.connected ? '✅ Conectado' : '⚠️ Desconectado'
      console.log(`[MQTT] Broker status: ${status}`)
    }
  }

  onMounted(() => {
    try {
      ;(window as any).config.onMqttEvent(handleMqttEvent)
    } catch (e) {
      console.warn('[MQTT] onMqttEvent not available:', e)
    }
  })

  // Note: IPC listeners are not easily removed in Electron's contextBridge pattern.
  // The listener is safe to leave — it will be GC'd when the window closes.
  onUnmounted(() => {})

  return { handleMqttEvent }
}
