import { ref, onMounted, onUnmounted, watch, isRef } from 'vue'
import type { Ref } from 'vue'

export function useIdle(timeoutSec: number | Ref<number | undefined> = 60) {
  const isIdle = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  function getTimeoutSec() {
    if (typeof timeoutSec === 'number') {
      return timeoutSec
    }
    return timeoutSec.value ?? 60
  }

  function resetTimer() {
    if (isIdle.value) {
      isIdle.value = false
    }
    if (timer) {
      clearTimeout(timer)
    }
    const currentTimeout = getTimeoutSec()
    if (currentTimeout > 0) {
      timer = setTimeout(() => {
        isIdle.value = true
      }, currentTimeout * 1000)
    }
  }

  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'wake-word-detected', 'user-activity']

  onMounted(() => {
    resetTimer()
    events.forEach(evt => window.addEventListener(evt, resetTimer))
  })

  if (isRef(timeoutSec)) {
    watch(timeoutSec, () => {
      resetTimer()
    })
  }

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
    events.forEach(evt => window.removeEventListener(evt, resetTimer))
  })

  return { isIdle, resetTimer }
}
