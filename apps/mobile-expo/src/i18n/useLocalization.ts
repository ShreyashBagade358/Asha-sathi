import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { i18n, LOCALE_STORAGE_KEY, persistLocale, SUPPORTED_LOCALES, type Locale } from './index';

/**
 * Drop-in equivalent of the web's apps/web-dashboard/src/hooks/useLocalization.ts
 * so screen code reads identically in both apps: const { t, locale, toggleLanguage } = useLocalization().
 */
export function useLocalization(): {
  t: ReturnType<typeof useTranslation>['t'];
  locale: Locale;
  toggleLanguage: () => void;
  setLocale: (locale: Locale) => void;
} {
  const { t } = useTranslation();

  const setLocale = useCallback((locale: Locale) => {
    void i18n.changeLanguage(locale);
    void persistLocale(locale);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLocale(i18n.language === 'hi' ? 'en' : 'hi');
  }, [setLocale]);

  const locale: Locale = SUPPORTED_LOCALES.includes(i18n.language as Locale) ? (i18n.language as Locale) : 'en';

  return { t, locale, toggleLanguage, setLocale };
}

export { LOCALE_STORAGE_KEY };
