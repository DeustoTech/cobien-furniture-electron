import { createI18n } from 'vue-i18n'
import es from './locales/es.json'
import fr from './locales/fr.json'
import en from './locales/en.json'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    es,
    fr,
    en
  }
})

export default i18n
