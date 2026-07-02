import { ref, onMounted, onUnmounted } from 'vue'

export function useIdle(timeoutSec: number = 60) {
  const isIdle = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  function resetTimer() {
    if (isIdle.value) {
      isIdle.value = false
    }
    if (timer) {
      clearTimeout(timer)
    }
    if (timeoutSec > 0) {
      timer = setTimeout(() => {
        isIdle.value = true
      }, timeoutSec * 1000)
    }
  }

  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'wake-word-detected', 'user-activity']


  onMounted(() => {
    resetTimer()
    events.forEach(evt => window.addEventListener(evt, resetTimer))
  })

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
    events.forEach(evt => window.removeEventListener(evt, resetTimer))
  })

  return { isIdle, resetTimer }
}
