import assert from 'node:assert/strict';
import test from 'node:test';

import { createInstance } from 'i18next';

import {
  DEFAULT_LOCALE,
  normalizeLocale,
  resolveBrowserLocale,
  resolveSignedInLocale,
  resolveSignedInLocaleState,
  resolveSignedOutLocale,
  shouldChangeAppLocale,
} from '../src/i18n/locale.ts';
import {
  APP_LOCALE_STORAGE_KEY,
  clearStoredAppLocale,
  getStoredAppLocale,
  setStoredAppLocale,
} from '../src/i18n/storage.ts';
import { translationResources } from '../src/i18n/resources.ts';
import {
  getSelectionStepDisplayName,
} from '../src/components/selection/selectionConstants.ts';
import {
  getBackfillPresetKey,
  getHistoricalPresetKey,
  shouldClearSelectionStepPreset,
} from '../convex/lib/selectionPresets.ts';
import {
  eventToFormValuesInJapan,
  formatEventDateForLocale,
  formatEventTimeForLocale,
} from '../src/components/events/eventFormattingCore.ts';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
    values,
  };
}

const localStorage = createMemoryStorage();
globalThis.window = { localStorage };

async function createTranslator(locale) {
  const instance = createInstance();
  await instance.init({
    resources: translationResources,
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return instance;
}

test('locale resolution follows user, storage, browser, then Japanese fallback', () => {
  assert.equal(resolveSignedInLocale('ja-JP', 'zh-CN', ['en-US']), 'ja-JP');
  assert.equal(resolveSignedInLocale(undefined, 'en-US', ['zh-CN']), 'en-US');
  assert.equal(resolveSignedOutLocale(null, ['zh-CN']), 'zh-CN');
  assert.equal(normalizeLocale('zh-TW'), 'zh-CN');
  assert.equal(normalizeLocale('en-GB'), 'en-US');
  assert.equal(resolveBrowserLocale(['fr-FR']), 'ja-JP');
  assert.equal(resolveBrowserLocale(['fr-FR', 'en-GB']), 'en-US');
});

test('appLocale storage writes only explicit values and rejects invalid values', () => {
  localStorage.values.clear();
  resolveSignedOutLocale(null, ['zh-CN']);
  assert.equal(localStorage.values.has(APP_LOCALE_STORAGE_KEY), false);

  setStoredAppLocale('en-US');
  assert.equal(getStoredAppLocale(), 'en-US');
  clearStoredAppLocale();
  assert.equal(getStoredAppLocale(), null);
  localStorage.setItem(APP_LOCALE_STORAGE_KEY, 'fr-FR');
  assert.equal(getStoredAppLocale(), null);
});

test('signed-in locale state carries registration choice without overwriting an existing user locale', () => {
  assert.deepEqual(resolveSignedInLocaleState(undefined, 'en-US', ['zh-CN']), {
    locale: 'en-US',
    localeToPersist: 'en-US',
    localeToStore: null,
  });
  assert.deepEqual(resolveSignedInLocaleState('ja-JP', 'en-US', ['zh-CN']), {
    locale: 'ja-JP',
    localeToPersist: null,
    localeToStore: 'ja-JP',
  });
});

test('language synchronization ignores a no-op locale change', () => {
  assert.equal(shouldChangeAppLocale('ja-JP', 'ja-JP'), false);
  assert.equal(shouldChangeAppLocale('ja-JP', 'en-US'), true);
});

test('preset display names are localized while custom names remain exact', async () => {
  const expected = {
    'zh-CN': '一面',
    'ja-JP': '一次面接',
    'en-US': 'First Interview',
  };

  for (const [locale, label] of Object.entries(expected)) {
    const translator = await createTranslator(locale);
    assert.equal(
      getSelectionStepDisplayName(
        { name: '一面', presetKey: 'first_interview' },
        translator.t.bind(translator),
      ),
      label,
    );
    assert.equal(
      getSelectionStepDisplayName(
        { name: '技术Leader面谈' },
        translator.t.bind(translator),
      ),
      '技术Leader面谈',
    );
  }
});

test('preset identity edits clear presetKey while completion-only changes preserve it', () => {
  const current = { name: '一面', type: 'interview' };
  assert.equal(shouldClearSelectionStepPreset(current, { name: '技术面试' }), true);
  assert.equal(shouldClearSelectionStepPreset(current, { type: 'other' }), true);
  assert.equal(shouldClearSelectionStepPreset(current, {}), false);
  assert.equal(shouldClearSelectionStepPreset(current, { name: ' 一面 ' }), false);
});

test('historical preset backfill is exact, type-safe, and idempotent', () => {
  assert.equal(getHistoricalPresetKey('一面', 'interview'), 'first_interview');
  assert.equal(getHistoricalPresetKey('一面 ', 'interview'), null);
  assert.equal(getHistoricalPresetKey('一面', 'other'), null);
  assert.equal(
    getBackfillPresetKey({ name: '一面', type: 'interview', presetKey: undefined }),
    'first_interview',
  );
  assert.equal(
    getBackfillPresetKey({ name: '一面', type: 'interview', presetKey: 'first_interview' }),
    null,
  );
});

test('event formatting keeps Japan time, 24-hour display, and date-only deadlines', () => {
  const datetime = Date.UTC(2026, 0, 15, 5, 0);
  const scheduled = { datetime, timingType: 'scheduled', hasExplicitTime: true };
  const deadline = {
    datetime: Date.UTC(2026, 0, 15, 14, 59, 59, 999),
    timingType: 'deadline',
    hasExplicitTime: false,
  };

  for (const locale of ['zh-CN', 'ja-JP', 'en-US']) {
    assert.equal(formatEventTimeForLocale(datetime, locale), '14:00');
    assert.match(formatEventDateForLocale(scheduled, locale), /14:00/u);
    assert.doesNotMatch(formatEventDateForLocale(deadline, locale), /23:59/u);
  }

  assert.equal(scheduled.datetime, datetime);
  assert.deepEqual(eventToFormValuesInJapan(scheduled), { date: '2026-01-15', time: '14:00' });
  assert.deepEqual(eventToFormValuesInJapan(deadline), { date: '2026-01-15', time: '' });
});

test('dynamic translations cover English pluralization, status, and relative labels', async () => {
  const translator = await createTranslator('en-US');
  assert.equal(translator.t('calendar:eventCount', { count: 1 }), '1 event');
  assert.equal(translator.t('calendar:eventCount', { count: 3 }), '3 events');
  assert.equal(translator.t('selection:status.waiting_result'), 'Awaiting result');
  assert.equal(translator.t('research:minutesAgo', { count: 5 }), 'Updated 5 minutes ago');
});
