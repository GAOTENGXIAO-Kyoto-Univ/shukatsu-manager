import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGoogleCalendarEventPayload,
  isReadableCalendarRole,
  isWritableCalendarRole,
  normalizeGoogleCalendarEvent,
} from '../convex/lib/googleCalendar.ts';
import {
  buildGoogleAuthorizationUrl,
  GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE,
  GOOGLE_CALENDAR_EVENTS_SCOPE,
  GOOGLE_CALENDAR_LIST_READONLY_SCOPE,
  GOOGLE_IDENTITY_SCOPES,
  LEGACY_GMAIL_READONLY_SCOPE,
  hasGoogleCapability,
  hasLegacyGmailScope,
} from '../convex/lib/googleOAuth.ts';
import { translationResources } from '../src/i18n/resources.ts';

test('Calendar OAuth requests only identity and narrow Calendar scopes', () => {
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'client-secret';
  process.env.GOOGLE_OAUTH_REDIRECT_URI = 'https://example.com/integrations/google/callback';
  const readUrl = new URL(buildGoogleAuthorizationUrl('state', 'calendar_read'));
  const writeUrl = new URL(buildGoogleAuthorizationUrl('state', 'calendar_write'));
  const readScopes = readUrl.searchParams.get('scope')?.split(' ') ?? [];
  const writeScopes = writeUrl.searchParams.get('scope')?.split(' ') ?? [];
  for (const identityScope of GOOGLE_IDENTITY_SCOPES) {
    assert.ok(readScopes.includes(identityScope));
    assert.ok(writeScopes.includes(identityScope));
  }
  assert.ok(readScopes.includes(GOOGLE_CALENDAR_LIST_READONLY_SCOPE));
  assert.ok(readScopes.includes(GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE));
  assert.ok(!readScopes.includes(GOOGLE_CALENDAR_EVENTS_SCOPE));
  assert.ok(writeScopes.includes(GOOGLE_CALENDAR_LIST_READONLY_SCOPE));
  assert.ok(writeScopes.includes(GOOGLE_CALENDAR_EVENTS_SCOPE));
  assert.ok(!readScopes.includes(LEGACY_GMAIL_READONLY_SCOPE));
  assert.ok(!writeScopes.includes(LEGACY_GMAIL_READONLY_SCOPE));
  assert.equal(readUrl.searchParams.get('include_granted_scopes'), null);
  assert.equal(writeUrl.searchParams.get('include_granted_scopes'), null);
  assert.equal(hasLegacyGmailScope([LEGACY_GMAIL_READONLY_SCOPE]), true);
  assert.equal(hasLegacyGmailScope(writeScopes), false);
  assert.equal(hasGoogleCapability(writeScopes, 'calendar_read'), true);
  assert.equal(hasGoogleCapability(readScopes, 'calendar_write'), false);
});

test('Calendar event normalization distinguishes timed and all-day events', () => {
  const timed = normalizeGoogleCalendarEvent({
    id: 'timed',
    eventType: 'default',
    summary: 'Interview',
    start: { dateTime: '2026-10-03T14:30:00+09:00' },
    end: { dateTime: '2026-10-03T15:30:00+09:00' },
    hangoutLink: 'https://meet.google.com/example',
  });
  assert.equal(timed?.allDay, false);
  assert.equal(timed?.meetingUrl, 'https://meet.google.com/example');
  const allDay = normalizeGoogleCalendarEvent({
    id: 'deadline',
    start: { date: '2026-10-10' },
    end: { date: '2026-10-11' },
  });
  assert.equal(allDay?.allDay, true);
  assert.equal(allDay?.startDate, '2026-10-10');
  assert.equal(normalizeGoogleCalendarEvent({ id: 'cancelled', status: 'cancelled' }), null);
});

test('Calendar export maps date-only deadlines to exclusive all-day end dates', () => {
  const payload = buildGoogleCalendarEventPayload({
    summary: 'Deadline',
    datetime: Date.UTC(2026, 8, 30, 14, 59, 59, 999),
    allDay: true,
    note: 'Submit the form',
    meetingUrl: 'https://example.com/form',
  });
  assert.deepEqual(payload.start, { date: '2026-09-30' });
  assert.deepEqual(payload.end, { date: '2026-10-01' });
  assert.match(payload.description ?? '', /Submit the form/);
  assert.match(payload.description ?? '', /https:\/\/example.com\/form/);
});

test('Calendar export keeps absolute instants for timed events', () => {
  const start = Date.parse('2026-10-03T14:30:00+09:00');
  const payload = buildGoogleCalendarEventPayload({
    summary: 'Interview',
    datetime: start,
    endTimestamp: start + 60 * 60 * 1000,
    allDay: false,
  });
  assert.deepEqual(payload.start, { dateTime: '2026-10-03T05:30:00.000Z' });
  assert.deepEqual(payload.end, { dateTime: '2026-10-03T06:30:00.000Z' });
});

test('Calendar roles separately enforce read and write access', () => {
  assert.equal(isReadableCalendarRole('reader'), true);
  assert.equal(isWritableCalendarRole('reader'), false);
  assert.equal(isReadableCalendarRole('owner'), true);
  assert.equal(isWritableCalendarRole('owner'), true);
  assert.equal(isReadableCalendarRole('freeBusyReader'), false);
});

test('Google Calendar UI copy exists in all three locales', () => {
  for (const locale of ['zh-CN', 'ja-JP', 'en-US']) {
    const calendar = translationResources[locale].googleCalendar;
    assert.ok(calendar.profile.connect);
    assert.ok(calendar.profile.legacyAuthorization);
    assert.ok(calendar.actions.authorizeWrite);
    assert.ok(calendar.conflict.overwrite);
    assert.ok(calendar.export.allDayHint);
    assert.ok(calendar.errors.partial);
  }
});
