import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import i18n, { SUPPORTED_LOCALES, type Locale } from '@/i18n'

const LOCALE_STORAGE_KEY = 'asha_sathi_locale'

export function useLocalization(): {
  t: ReturnType<typeof useTranslation>['t']
  locale: string
  toggleLanguage: () => void
  setLocale: (locale: Locale) => void
} {
  const { t } = useTranslation()

  const setLocale = useCallback((locale: Locale) => {
    void i18n.changeLanguage(locale)
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  }, [])

  const toggleLanguage = useCallback(() => {
    const next: Locale = i18n.language === 'hi' ? 'en' : 'hi'
    setLocale(next)
  }, [setLocale])

  const locale = SUPPORTED_LOCALES.includes(i18n.language as Locale) ? i18n.language : 'en'

  return { t, locale, toggleLanguage, setLocale }
}
