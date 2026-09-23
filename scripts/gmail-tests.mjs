import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractGmailBody,
  htmlToVisibleText,
} from '../convex/lib/gmailMessage.ts';
import {
  inferRecruitingDateYear,
  parseRecruitingMail,
} from '../convex/lib/gmailParser.ts';
import {
  decryptRefreshToken,
  encryptRefreshToken,
  hashOAuthState,
} from '../convex/lib/googleOAuth.ts';
import { planSelectionProgressTransition } from '../convex/lib/selectionProgressHistory.ts';
import {
  matchApplicationCandidate,
  matchCompanyCandidate,
  matchSelectionStepCandidate,
} from '../src/lib/gmailMatching.ts';
import { translationResources } from '../src/i18n/resources.ts';

function base64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

test('Gmail MIME extraction prefers plain text and ignores files and images', async () => {
  const result = await extractGmailBody({
    snippet: 'fallback',
    payload: {
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/html', body: { data: base64Url('<p>HTML body</p>') } },
        { mimeType: 'text/plain', body: { data: base64Url('Plain body') } },
        { mimeType: 'text/plain', filename: 'attached.txt', body: { data: base64Url('secret attachment') } },
        { mimeType: 'image/png', body: { data: base64Url('image') } },
      ],
    },
  }, async () => { throw new Error('attachment should not load'); });
  assert.deepEqual(result, { bodyText: 'Plain body', bodySource: 'plain' });
});

test('HTML-only mail becomes visible text and text body attachment ids are supported', async () => {
  assert.equal(htmlToVisibleText('<style>x</style><p>Hello &amp; welcome</p><ul><li>Next</li></ul>'), 'Hello & welcome\n- Next');
  const result = await extractGmailBody({
    payload: { mimeType: 'text/plain', body: { attachmentId: 'text-body' } },
  }, async (id) => {
    assert.equal(id, 'text-body');
    return base64Url('Fetched text body');
  });
  assert.equal(result.bodyText, 'Fetched text body');
});

test('parser keeps historical and target steps separate and extracts event candidates', () => {
  const parsed = parseRecruitingMail({
    messageId: 'message-1',
    internalDate: Date.UTC(2026, 8, 20),
    subject: '株式会社Example 一次面接の結果と次回選考',
    from: '株式会社Example 採用担当 <recruit@example.com>',
    bodyText: [
      '会社名：株式会社Example',
      '応募職種：Software Engineer',
      '一次面接の結果、通過となりました。次回は二次面接です。',
      '二次面接は10月3日（土）14:30に実施します。',
      '場所：東京本社',
      '回答期限：9月25日 23:59まで',
    ].join('\n'),
  });
  assert.equal(parsed.companyCandidate?.value, '株式会社Example');
  assert.equal(parsed.jobCandidate?.value, 'Software Engineer');
  assert.equal(parsed.historicalStepCandidates[0].name, '一次面接');
  assert.equal(parsed.historicalStepCandidates[0].result, 'passed');
  assert.equal(parsed.targetStepCandidates[0].name, '二次面接');
  assert.equal(parsed.mainTimeCandidate?.date, '2026-10-03');
  assert.equal(parsed.mainTimeCandidate?.time, '14:30');
  assert.equal(parsed.locationCandidate?.value, '東京本社');
  assert.ok(parsed.secondaryTimeCandidates.some((candidate) => candidate.timingType === 'deadline'));
});

test('parser never turns URLs into company, job, or location business fields', () => {
  const parsed = parseRecruitingMail({
    messageId: 'message-2',
    internalDate: Date.UTC(2026, 0, 1),
    subject: '選考案内',
    from: 'recruit@example.com',
    bodyText: '会社名：https://example.com\n職種：www.example.com/job\n場所：https://meet.example.com',
  });
  assert.equal(parsed.companyCandidate, undefined);
  assert.equal(parsed.jobCandidate, undefined);
  assert.equal(parsed.locationCandidate, undefined);
});

test('year inference chooses the nearby recruiting year across year boundaries', () => {
  assert.equal(inferRecruitingDateYear(1, 8, Date.UTC(2026, 11, 28)), 2027);
  assert.equal(inferRecruitingDateYear(12, 20, Date.UTC(2027, 0, 3)), 2026);
});

test('matching defaults only unique explicit normalized matches', () => {
  const companies = [{ id: 'a', name: '株式会社 Example' }, { id: 'b', name: 'Other' }];
  assert.equal(matchCompanyCandidate('Example株式会社', companies).kind, 'exact');
  assert.equal(matchCompanyCandidate('Ex', companies).kind, 'none');
  assert.equal(matchApplicationCandidate(undefined, [{ jobTitle: 'Engineer' }]).kind, 'exact');
  assert.equal(matchApplicationCandidate(undefined, [{ jobTitle: 'Engineer' }, { jobTitle: 'Sales' }]).kind, 'possible');
  assert.equal(matchSelectionStepCandidate('二次面接', [{ name: '二次面接' }, { name: '二次面接' }]).kind, 'possible');
});

test('refresh tokens round-trip through AES-GCM and OAuth state hashes are deterministic', async () => {
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  const encrypted = await encryptRefreshToken('refresh-token-value');
  assert.notEqual(encrypted.ciphertext, 'refresh-token-value');
  assert.equal(await decryptRefreshToken(encrypted.ciphertext, encrypted.iv), 'refresh-token-value');
  assert.equal(await hashOAuthState('state-a'), await hashOAuthState('state-a'));
  assert.notEqual(await hashOAuthState('state-a'), await hashOAuthState('state-b'));
});

test('Gmail result imports reuse the existing selection progress transition invariant', () => {
  assert.deepEqual(
    planSelectionProgressTransition(
      { completed: false, result: null },
      { completed: true, result: 'passed' },
    ),
    { invalidateTypes: [], createType: 'passed' },
  );
  assert.deepEqual(
    planSelectionProgressTransition(
      { completed: true, result: 'passed' },
      { completed: true, result: 'passed' },
    ),
    { invalidateTypes: [], createType: null },
  );
});

test('Gmail UI copy exists in all three locales', () => {
  for (const locale of ['zh-CN', 'ja-JP', 'en-US']) {
    const gmail = translationResources[locale].gmail;
    assert.ok(gmail.profile.connect);
    assert.ok(gmail.search.placeholder);
    assert.ok(gmail.confirm.eventConflict);
    assert.ok(gmail.errors.stale);
  }
});
