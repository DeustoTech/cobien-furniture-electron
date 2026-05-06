import { ref, watch } from 'vue'
import i18n from '../i18n'

const lang = ref(localStorage.getItem('cobien_lang') || 'es')
const ttsEngine = ref<'piper'>(localStorage.getItem('cobien_tts_engine') as any || 'piper')
const voiceGenders = ref<Record<string, 'male' | 'female'>>(
  JSON.parse(localStorage.getItem('cobien_voice_genders') || '{"es": "male", "fr": "female"}')
)

watch(lang, (newLang) => {
  localStorage.setItem('cobien_lang', newLang)
  i18n.global.locale.value = newLang as any
})

watch(ttsEngine, (newEngine) => {
  localStorage.setItem('cobien_tts_engine', newEngine)
})

watch(voiceGenders, (newGenders) => {
  localStorage.setItem('cobien_voice_genders', JSON.stringify(newGenders))
}, { deep: true })

// Initialize i18n
i18n.global.locale.value = lang.value as any

export function useSettings() {
  return {
    lang,
    ttsEngine,
    voiceGenders
  }
}

