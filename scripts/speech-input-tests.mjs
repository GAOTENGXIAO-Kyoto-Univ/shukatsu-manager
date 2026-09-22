import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getStoredSpeechLanguage,
  mergeVoiceTranscript,
  resolveInitialSpeechLanguage,
  setStoredSpeechLanguage,
  SPEECH_LANGUAGES,
  SPEECH_LANGUAGE_STORAGE_KEY,
} from '../src/components/voice/voiceInputCore.ts';
import {
  collectSpeechRecognitionTranscript,
} from '../src/components/voice/speechRecognitionTypes.ts';
import {
  claimSpeechSession,
  releaseSpeechSession,
} from '../src/components/voice/speechSessionCoordinator.ts';
import { translationResources } from '../src/i18n/resources.ts';

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

test('voice transcript merge inserts at a reliable collapsed cursor without a newline', () => {
  assert.equal(
    mergeVoiceTranscript({
      baseValue: '前半后半',
      selection: { start: 2, end: 2 },
      transcript: '插入',
    }),
    '前半插入后半',
  );
});

test('voice transcript merge appends safely when the selection is absent or expanded', () => {
  assert.equal(
    mergeVoiceTranscript({ baseValue: '', transcript: 'first' }),
    'first',
  );
  assert.equal(
    mergeVoiceTranscript({ baseValue: 'existing', transcript: 'next' }),
    'existing\nnext',
  );
  assert.equal(
    mergeVoiceTranscript({ baseValue: 'existing\n', transcript: 'next' }),
    'existing\nnext',
  );
  assert.equal(
    mergeVoiceTranscript({
      baseValue: 'existing',
      selection: { start: 1, end: 4 },
      transcript: 'next',
    }),
    'existing\nnext',
  );
});

test('an empty voice transcript never changes the committed value', () => {
  assert.equal(
    mergeVoiceTranscript({
      baseValue: 'keep me',
      selection: { start: 2, end: 2 },
      transcript: '   ',
    }),
    'keep me',
  );
});

test('speech language follows stored preference, then the current UI locale', () => {
  assert.deepEqual(SPEECH_LANGUAGES, ['ja-JP', 'zh-CN', 'en-US']);
  localStorage.values.clear();
  assert.equal(resolveInitialSpeechLanguage(null, 'zh-CN'), 'zh-CN');
  assert.equal(resolveInitialSpeechLanguage('en-US', 'zh-CN'), 'en-US');
  assert.equal(resolveInitialSpeechLanguage('fr-FR', 'ja-JP'), 'ja-JP');

  setStoredSpeechLanguage('en-US');
  assert.equal(localStorage.values.get(SPEECH_LANGUAGE_STORAGE_KEY), 'en-US');
  assert.equal(getStoredSpeechLanguage(), 'en-US');
});

test('voice input UI copy exists in all three locales', () => {
  for (const locale of ['zh-CN', 'ja-JP', 'en-US']) {
    const voice = translationResources[locale].voice;
    assert.ok(voice.status.listening);
    assert.ok(voice.status.waitingPermission);
    assert.ok(voice.actions.start);
    assert.ok(voice.actions.stop);
    assert.ok(voice.actions.cancel);
    assert.ok(voice.actions.confirm);
    assert.ok(voice.actions.chooseLanguage);
    assert.ok(voice.errors.noSpeech);
    assert.ok(voice.errors.permissionDenied);
    assert.ok(voice.errors.unavailable);
  }
});

test('speech result aggregation keeps final and current interim results in order', () => {
  assert.deepEqual(
    collectSpeechRecognitionTranscript({
      results: [
        { 0: { transcript: 'final ' }, isFinal: true },
        { 0: { transcript: 'interim' }, isFinal: false },
      ],
    }),
    {
      finalTranscript: 'final ',
      interimTranscript: 'interim',
      transcript: 'final interim',
    },
  );
});

test('claiming a speech session cancels the old one and stale release cannot clear the new one', () => {
  const first = Symbol('first');
  const second = Symbol('second');
  const third = Symbol('third');
  let firstCancelled = 0;
  let secondCancelled = 0;

  claimSpeechSession(first, () => {
    firstCancelled += 1;
  });
  claimSpeechSession(second, () => {
    secondCancelled += 1;
  });
  assert.equal(firstCancelled, 1);

  releaseSpeechSession(first);
  claimSpeechSession(third, () => {});
  assert.equal(secondCancelled, 1);
  releaseSpeechSession(third);
});
