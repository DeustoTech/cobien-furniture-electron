<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useIdle } from '../composables/useIdle'

const props = defineProps<{
  timeoutSec?: number
}>()

const { t } = useI18n()
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
  cursor: none;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
}

.idle-hint {
  color: rgba(255, 255, 255, 0.3);
  font-size: 1.2rem;
  padding: 2rem;
  font-weight: 300;
  user-select: none;
  text-align: right;
  max-width: 50%;
}
</style>
