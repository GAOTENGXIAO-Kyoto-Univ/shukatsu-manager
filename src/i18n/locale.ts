export const SUPPORTED_LOCALES = ['zh-CN', 'ja-JP', 'en-US'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'ja-JP';

export const LOCALE_DISPLAY_NAMES: Record<AppLocale, string> = {
  'zh-CN': '简体中文',
  'ja-JP': '日本語',
  'en-US': 'English',
};

export function isSupportedLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && SUPPORTED_LOCALES.includes(value as AppLocale);
}

export function normalizeLocale(value: string | null | undefined): AppLocale | null {
  const language = value?.trim().toLowerCase();

  if (!language) return null;
  if (language === 'zh' || language.startsWith('zh-')) return 'zh-CN';
  if (language === 'ja' || language.startsWith('ja-')) return 'ja-JP';
  if (language === 'en' || language.startsWith('en-')) return 'en-US';
  return null;
}

export function resolveBrowserLocale(preferences: readonly string[]): AppLocale {
  for (const preference of preferences) {
    const locale = normalizeLocale(preference);
    if (locale) return locale;
  }

  return DEFAULT_LOCALE;
}

export function resolveSignedOutLocale(
  storedLocale: string | null | undefined,
  browserPreferences: readonly string[],
): AppLocale {
  return isSupportedLocale(storedLocale)
    ? storedLocale
    : resolveBrowserLocale(browserPreferences);
}

export function resolveSignedInLocale(
  userLocale: string | null | undefined,
  storedLocale: string | null | undefined,
  browserPreferences: readonly string[],
): AppLocale {
  if (isSupportedLocale(userLocale)) return userLocale;
  return resolveSignedOutLocale(storedLocale, browserPreferences);
}

export function resolveSignedInLocaleState(
  userLocale: string | null | undefined,
  storedLocale: string | null | undefined,
  browserPreferences: readonly string[],
) {
  const locale = resolveSignedInLocale(userLocale, storedLocale, browserPreferences);

  return {
    locale,
    localeToPersist: !isSupportedLocale(userLocale) && isSupportedLocale(storedLocale)
      ? storedLocale
      : null,
    localeToStore: isSupportedLocale(userLocale) ? userLocale : null,
  };
}

export function shouldChangeAppLocale(currentLocale: AppLocale, nextLocale: AppLocale) {
  return currentLocale !== nextLocale;
}
