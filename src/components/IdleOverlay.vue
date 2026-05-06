<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useIdle } from '../composables/useIdle'

const props = defineProps<{
  timeoutSec?: number
}>()

const { isIdle, resetTimer } = useIdle(props.timeoutSec || 60)
const settings = ref<any>({})

onMounted(async () => {
  settings.value = await (window as any).config.getSettings()
})

watch(isIdle, (newVal) => {
  if (newVal) {
    console.log('[IDLE] Screen blacked out')
  }
})

function wakeUp() {
  resetTimer()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isIdle" class="idle-overlay" @mousedown="wakeUp" @touchstart="wakeUp">
      <!-- Complete black screen -->
    </div>
  </Teleport>
</template>

<style scoped>
.idle-overlay {
  position: fixed;
  inset: 0;
  background: black;
  z-index: 99999;
  cursor: none;
}
</style>
