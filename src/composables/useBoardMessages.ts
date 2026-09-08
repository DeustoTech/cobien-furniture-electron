import { ref } from 'vue'

const unreadBoardCount = ref(0)
let cachedDeviceId = ''

export function useBoardMessages() {
  async function refreshUnreadCount() {
    try {
      if (!cachedDeviceId) {
        const sys = await (window as any).config?.getSystemInfo()
        if (sys?.deviceId) cachedDeviceId = sys.deviceId
      }
      const messages = await (window as any).config?.getBoardMessages()
      if (Array.isArray(messages)) {
        const deviceId = cachedDeviceId || 'CoBien6'
        const unread = messages.filter((m: any) => !m.read_by || !m.read_by.includes(deviceId))
        unreadBoardCount.value = unread.length
      }
    } catch (e) {
      console.error('[BOARD] Error updating unread board count:', e)
    }
  }

  function setUnreadCount(count: number) {
    unreadBoardCount.value = count
  }

  function decrementUnreadCount() {
    if (unreadBoardCount.value > 0) {
      unreadBoardCount.value--
    }
  }

  return {
    unreadBoardCount,
    refreshUnreadCount,
    setUnreadCount,
    decrementUnreadCount
  }
}
