import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  resolveSignedInLocaleState,
  resolveSignedOutLocale,
  shouldChangeAppLocale,
  SUPPORTED_LOCALES,
  type AppLocale,
} from './locale';
import { translationNamespaces, translationResources } from './resources';
import { getStoredAppLocale, setStoredAppLocale } from './storage';

const i18n = createInstance();

export function detectBrowserLocalePreferences() {
  try {
    return getLocales().map((locale) => locale.languageTag);
  } catch {
    return [];
  }
}

const initialLocale = resolveSignedOutLocale(
  getStoredAppLocale(),
  detectBrowserLocalePreferences(),
);

void i18n.use(initReactI18next).init({
  resources: translationResources,
  supportedLngs: [...SUPPORTED_LOCALES],
  fallbackLng: DEFAULT_LOCALE,
  lng: initialLocale,
  ns: translationNamespaces,
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});

function syncDocumentLanguage(locale: AppLocale) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}

syncDocumentLanguage(initialLocale);
i18n.on('languageChanged', (language) => {
  if (isSupportedLocale(language)) syncDocumentLanguage(language);
});

export function getCurrentAppLocale(): AppLocale {
  return isSupportedLocale(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LOCALE;
}

export async function changeAppLocale(locale: AppLocale) {
  setStoredAppLocale(locale);
  if (shouldChangeAppLocale(getCurrentAppLocale(), locale)) {
    await i18n.changeLanguage(locale);
  }
}

export async function reconcileSignedInLocale(userLocale: string | null | undefined) {
  const storedLocale = getStoredAppLocale();
  const { locale, localeToPersist, localeToStore } = resolveSignedInLocaleState(
    userLocale,
    storedLocale,
    detectBrowserLocalePreferences(),
  );

  if (localeToStore) {
    setStoredAppLocale(localeToStore);
  }

  if (shouldChangeAppLocale(getCurrentAppLocale(), locale)) {
    await i18n.changeLanguage(locale);
  }

  return {
    locale,
    localeToPersist,
  };
}

export { i18n };
export * from './locale';
export * from './storage';
