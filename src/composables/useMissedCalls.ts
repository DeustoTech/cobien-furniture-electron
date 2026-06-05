import { ref } from 'vue'

export interface MissedCall {
  id: string
  author: string
  userName: string
  time: string
}

const missedCalls = ref<MissedCall[]>([])

export function useMissedCalls() {
  function addMissedCall(call: Omit<MissedCall, 'id'>) {
    // Evitar añadir la misma llamada perdida seguida del mismo autor si ha sido reciente
    if (missedCalls.value.length > 0 && missedCalls.value[0].author === call.author) {
       missedCalls.value[0].time = call.time
       return
    }
    missedCalls.value.unshift({ ...call, id: Date.now().toString() })
  }
  
  function removeMissedCall(id: string) {
    const index = missedCalls.value.findIndex(c => c.id === id)
    if (index !== -1) missedCalls.value.splice(index, 1)
  }
  
  function clearMissedCalls() {
    missedCalls.value = []
  }

  return {
    missedCalls,
    addMissedCall,
    removeMissedCall,
    clearMissedCalls
  }
}
