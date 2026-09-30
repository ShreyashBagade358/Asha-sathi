import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en';
import hi from './hi';

export const SUPPORTED_LOCALES = ['en', 'hi'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_STORAGE_KEY = 'asha_sathi_locale';

/**
 * Device-language detection, mirroring the web's initialLocale() in
 * apps/web-dashboard/src/i18n/index.ts. Android reports 'hi' / 'hi-IN' for
 * Hindi and iOS may report 'hi-IN' too, so we match on the primary subtag.
 */
function deviceLocale(): Locale {
  const tag = Localization.getLocales()[0]?.languageTag?.toLowerCase() ?? '';
  return tag.startsWith('hi') ? 'hi' : 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: deviceLocale(),
  fallbackLng: 'en',
  // React already escapes rendered text; escaping here would double-encode.
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

/** Loads the persisted preference and applies it. Called once from the root layout. */
export async function hydrateLocale(): Promise<Locale> {
  try {
    const stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    const next = SUPPORTED_LOCALES.includes(stored as Locale) ? (stored as Locale) : deviceLocale();
    if (i18n.language !== next) {
      await i18n.changeLanguage(next);
    }
    return next;
  } catch {
    return deviceLocale();
  }
}

export async function persistLocale(locale: Locale): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage unavailable - the in-memory switch still applies for this session.
  }
}

export default i18n;
export { i18n };
