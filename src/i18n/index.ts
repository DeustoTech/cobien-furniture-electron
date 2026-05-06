import { createI18n } from 'vue-i18n'
import es from './locales/es.json'
import fr from './locales/fr.json'

const i18n = createI18n({
  legacy: false,
  locale: 'es',
  fallbackLocale: 'es',
  messages: {
    es,
    fr
  }
})

export default i18n
