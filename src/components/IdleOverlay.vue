<script setup lang="ts">
import { ref, onMounted, watch, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useIdle } from '../composables/useIdle'

const props = defineProps<{
  timeoutSec?: number
}>()

const { t } = useI18n()
const { isIdle, resetTimer } = useIdle(toRef(props, 'timeoutSec'))
const settings = ref<any>({})

onMounted(async () => {
  settings.value = await (window as any).config.getSettings()
})

watch(isIdle, (newVal, oldVal) => {
  if (newVal) {
    console.log('[IDLE] Screen blacked out')
  } else if (oldVal === true) {
    console.log('[IDLE] Screen woke up')
    if ((window as any).config && (window as any).config.logScreenWakeup) {
      (window as any).config.logScreenWakeup().catch(() => {})
    }
  }
})

function wakeUp() {
  resetTimer()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isIdle" class="idle-overlay" @mousedown="wakeUp" @touchstart="wakeUp">
      <div class="idle-hint">
        {{ t('common.idle_hint') }}
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.idle-overlay {
  position: fixed;
  inset: 0;
  background: black;
  z-index: 99999;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;
}

.idle-hint {
  color: rgba(255, 255, 255, 0.88);
  font-size: clamp(2rem, 3.5vw, 3.2rem);
  font-weight: 600;
  user-select: none;
  text-align: center;
  max-width: 80%;
  line-height: 1.4;
  letter-spacing: 0.5px;
  text-shadow: 0 4px 16px rgba(0, 0, 0, 0.7);
  animation: idleGlow 3s ease-in-out infinite alternate;
}

@keyframes idleGlow {
  0% { opacity: 0.75; transform: scale(0.99); }
  100% { opacity: 1; transform: scale(1.01); }
}
</style>
