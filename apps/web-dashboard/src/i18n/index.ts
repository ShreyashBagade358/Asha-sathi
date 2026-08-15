import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en'
import hi from './hi'

export const SUPPORTED_LOCALES = ['en', 'hi'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

const LOCALE_STORAGE_KEY = 'asha_sathi_locale'

function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
      return stored as Locale
    }
  } catch {
    // localStorage unavailable (SSR/private mode) — fall through.
  }
  const nav = navigator.language?.toLowerCase()
  if (nav?.startsWith('hi')) return 'hi'
  return 'en'
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: initialLocale(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
