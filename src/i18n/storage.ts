import { isSupportedLocale, type AppLocale } from './locale';

export const APP_LOCALE_STORAGE_KEY = 'appLocale';

function getLocalStorage() {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getStoredAppLocale(): AppLocale | null {
  const value = getLocalStorage()?.getItem(APP_LOCALE_STORAGE_KEY);
  return isSupportedLocale(value) ? value : null;
}

export function setStoredAppLocale(locale: AppLocale) {
  getLocalStorage()?.setItem(APP_LOCALE_STORAGE_KEY, locale);
}

export function clearStoredAppLocale() {
  getLocalStorage()?.removeItem(APP_LOCALE_STORAGE_KEY);
}

