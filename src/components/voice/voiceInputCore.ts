import { isSupportedLocale, type AppLocale } from '../../i18n/locale';

export const SPEECH_LANGUAGE_STORAGE_KEY = 'speech.lastLanguage';

export type SpeechLanguage = AppLocale;

export const SPEECH_LANGUAGES: readonly SpeechLanguage[] = [
  'ja-JP',
  'zh-CN',
  'en-US',
];

export type VoiceSelection = {
  start: number;
  end: number;
};

const speechLanguageListeners = new Set<(language: SpeechLanguage) => void>();
let lastSpeechLanguage: SpeechLanguage | null = null;

function getLocalStorage() {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getStoredSpeechLanguage(): SpeechLanguage | null {
  if (lastSpeechLanguage) return lastSpeechLanguage;

  try {
    const value = getLocalStorage()?.getItem(SPEECH_LANGUAGE_STORAGE_KEY);
    lastSpeechLanguage = isSupportedLocale(value) ? value : null;
    return lastSpeechLanguage;
  } catch {
    return null;
  }
}

export function setStoredSpeechLanguage(language: SpeechLanguage) {
  lastSpeechLanguage = language;
  try {
    getLocalStorage()?.setItem(SPEECH_LANGUAGE_STORAGE_KEY, language);
  } catch {
    // A blocked storage area must not make voice input unusable for this session.
  }

  speechLanguageListeners.forEach((listener) => listener(language));
}

export function subscribeToSpeechLanguage(
  listener: (language: SpeechLanguage) => void,
) {
  speechLanguageListeners.add(listener);
  return () => {
    speechLanguageListeners.delete(listener);
  };
}

export function resolveInitialSpeechLanguage(
  storedLanguage: string | null | undefined,
  appLocale: AppLocale,
): SpeechLanguage {
  return isSupportedLocale(storedLanguage) ? storedLanguage : appLocale;
}

export function getReliableVoiceSelection(
  selection: VoiceSelection | null | undefined,
  valueLength: number,
): VoiceSelection | null {
  if (
    !selection ||
    !Number.isInteger(selection.start) ||
    !Number.isInteger(selection.end) ||
    selection.start < 0 ||
    selection.end < 0 ||
    selection.start > valueLength ||
    selection.end > valueLength
  ) {
    return null;
  }

  return selection.start === selection.end ? selection : null;
}

export function mergeVoiceTranscript({
  baseValue,
  selection,
  transcript,
}: {
  baseValue: string;
  selection?: VoiceSelection | null;
  transcript: string;
}) {
  const normalizedTranscript = transcript.trim();

  if (!normalizedTranscript) return baseValue;

  const reliableSelection = getReliableVoiceSelection(selection, baseValue.length);
  if (reliableSelection) {
    const cursor = reliableSelection.start;
    return `${baseValue.slice(0, cursor)}${normalizedTranscript}${baseValue.slice(cursor)}`;
  }

  if (!baseValue) return normalizedTranscript;
  return `${baseValue}${baseValue.endsWith('\n') ? '' : '\n'}${normalizedTranscript}`;
}
