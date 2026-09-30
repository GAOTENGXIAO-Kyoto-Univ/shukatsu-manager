import { ArrowLeft, CalendarDays, CheckCircle2 } from '@tamagui/lucide-icons-2';
import { useAction, useMutation, useQuery_experimental as useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { Label, Spinner, Text, XStack, YStack, useMedia } from 'tamagui';

import { api } from '../../../../../../convex/_generated/api';
import type { Id } from '../../../../../../convex/_generated/dataModel';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { eventToFormValuesInJapan } from '@/components/events/eventFormattingCore';
import { startGoogleOAuth } from '@/lib/googleOAuthFlow';

type CalendarList = FunctionReturnType<typeof api.googleCalendar.listCalendars>;
type EventList = FunctionReturnType<typeof api.googleCalendar.listEvents>;
type GoogleEvent = EventList['events'][number];
type Preview = FunctionReturnType<typeof api.googleCalendar.getEventPreview>;
type TimingType = 'scheduled' | 'deadline';

function getErrorCode(error: unknown) {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === 'object' && data && 'code' in data) {
      return String((data as { code: unknown }).code);
    }
  }
  return error instanceof Error ? error.message : '';
}

function japanDate(timestamp: number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

function eventLabel(event: GoogleEvent, locale: string) {
  if (event.allDay) return event.startDate;
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(event.startTimestamp));
}

export default function GoogleCalendarImportScreen() {
  const { t, i18n } = useTranslation(['googleCalendar', 'common']);
  const router = useRouter();
  const media = useMedia();
  const connection = useQuery({ query: api.googleConnections.current, args: {} });
  const targetsState = useQuery({ query: api.events.listSelectionStepTargets, args: {} });
  const beginAuthorization = useAction(api.googleOAuth.beginCalendarAuthorization);
  const listCalendars = useAction(api.googleCalendar.listCalendars);
  const listEvents = useAction(api.googleCalendar.listEvents);
  const getPreview = useAction(api.googleCalendar.getEventPreview);
  const finalizeImport = useMutation(api.googleCalendar.finalizeImport);
  const loadedCalendars = useRef(false);

  const [today] = useState(() => japanDate(Date.now()));
  const [fromDate, setFromDate] = useState(addDays(today, -90));
  const [toDate, setToDate] = useState(addDays(today, 180));
  const [calendars, setCalendars] = useState<CalendarList>([]);
  const [calendarId, setCalendarId] = useState('');
  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState<'authorize' | 'calendars' | 'events' | 'more' | 'preview' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [targetKind, setTargetKind] = useState<'independent' | 'selection_step'>('independent');
  const [title, setTitle] = useState('');
  const [applicationId, setApplicationId] = useState<Id<'applications'> | null>(null);
  const [selectionStepId, setSelectionStepId] = useState<Id<'selectionSteps'> | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [timingType, setTimingType] = useState<TimingType>('scheduled');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [note, setNote] = useState('');

  const selectedApplication = useMemo(
    () => targetsState.status === 'success'
      ? targetsState.data.find((target) => target.applicationId === applicationId) ?? null
      : null,
    [applicationId, targetsState],
  );
  const selectedStep = selectedApplication?.steps.find(
    (step) => step.selectionStepId === selectionStepId,
  ) ?? null;

  useEffect(() => {
    if (
      loadedCalendars.current ||
      connection.status !== 'success' ||
      !connection.data?.calendarEnabled ||
      !connection.data.hasCalendarReadScope
    ) return;
    loadedCalendars.current = true;
    setBusy('calendars');
    void listCalendars({})
      .then((result) => {
        setCalendars(result);
        setCalendarId(result.find((calendar) => calendar.primary && calendar.readable)?.id ?? result.find((calendar) => calendar.readable)?.id ?? '');
      })
      .catch(() => setError(t('errors.calendars')))
      .finally(() => setBusy(null));
  }, [connection, listCalendars, t]);

  async function authorize() {
    setBusy('authorize');
    setError(null);
    try {
      const result = await beginAuthorization({ access: 'read' });
      startGoogleOAuth(result.authorizationUrl, '/integrations/google/calendar/import');
    } catch {
      setError(t('errors.connection'));
      setBusy(null);
    }
  }

  async function loadEventPage(loadMore = false) {
    if (!calendarId) return;
    setBusy(loadMore ? 'more' : 'events');
    setError(null);
    try {
      const result = await listEvents({
        calendarId,
        timeMin: `${fromDate}T00:00:00+09:00`,
        timeMax: `${addDays(toDate, 1)}T00:00:00+09:00`,
        ...(loadMore && nextPageToken ? { pageToken: nextPageToken } : {}),
      });
      setEvents((current) => loadMore ? [...current, ...result.events] : result.events);
      setNextPageToken(result.nextPageToken);
      if (!loadMore) {
        setSelectedEventId(null);
        setPreview(null);
        setReviewing(false);
      }
    } catch {
      setError(t('errors.events'));
    } finally {
      setBusy(null);
    }
  }

  async function selectEvent(event: GoogleEvent) {
    setSelectedEventId(event.googleEventId);
    setPreview(null);
    setReviewing(false);
    setBusy('preview');
    setError(null);
    try {
      const result = await getPreview({ calendarId, googleEventId: event.googleEventId });
      setPreview(result);
      setTitle(result.summary || t('preview.noTitle'));
      setLocation(result.location ?? '');
      setMeetingUrl(result.meetingUrl ?? '');
      setNote(result.description ?? '');
      if (result.allDay) {
        setDate(result.startDate);
        setTime('');
        setTimingType('deadline');
      } else {
        const values = eventToFormValuesInJapan({
          datetime: result.startTimestamp,
          timingType: 'scheduled',
          hasExplicitTime: true,
        });
        setDate(values.date);
        setTime(values.time);
        setTimingType('scheduled');
      }
    } catch {
      setError(t('errors.preview'));
    } finally {
      setBusy(null);
    }
  }

  async function commitImport() {
    if (!preview) return;
    setBusy('import');
    setError(null);
    try {
      await finalizeImport({
        googleCalendarId: calendarId,
        googleEventId: preview.googleEventId,
        targetKind,
        title,
        ...(targetKind === 'selection_step' && selectionStepId ? { selectionStepId } : {}),
        overwriteExisting,
        timingType,
        date,
        time: time || null,
        location: location || null,
        meetingUrl: meetingUrl || null,
        note: note || null,
      });
      setSuccess(true);
    } catch (caught) {
      const code = getErrorCode(caught);
      setError(
        code.includes('ALREADY_IMPORTED') || code.includes('ALREADY_LINKED')
          ? t('states.alreadyImported')
          : t('errors.import'),
      );
    } finally {
      setBusy(null);
    }
  }

  if (connection.status === 'pending') return <CenteredState text={t('states.loading')} />;
  if (connection.status === 'error') return <CenteredState error text={t('errors.calendars')} />;
  if (!connection.data?.calendarEnabled || !connection.data.hasCalendarReadScope) {
    return (
      <CenteredState
        error
        text={t('states.notConnected')}
        action={<AppButton variant="primary" disabled={busy === 'authorize'} onPress={() => void authorize()}>{busy === 'authorize' ? t('profile.connecting') : t('actions.authorizeRead')}</AppButton>}
      />
    );
  }
  if (success) {
    return <CenteredState icon={<CheckCircle2 color="$success" size={38} />} text={t('states.importSuccess')} action={<AppButton variant="primary" onPress={() => router.replace('/calendar' as Href)}>{t('actions.back')}</AppButton>} />;
  }

  const targets = targetsState.status === 'success' ? targetsState.data : [];
  const invalid = !preview || Boolean(preview.linkedEventId) || !date ||
    (timingType === 'scheduled' && !time) ||
    (targetKind === 'independent' ? !title.trim() : !selectionStepId) ||
    (targetKind === 'selection_step' && Boolean(selectedStep?.event) && !overwriteExisting);

  return (
    <YStack bg="$background" flex={1} minH={0}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        <YStack gap="$xl" maxW={1180} p="$base" pb="$xxl" width="100%" style={{ alignSelf: 'center' }}>
          <YStack gap="$sm" pt="$md">
            <AppButton icon={<ArrowLeft size={17} />} variant="ghost" style={{ alignSelf: 'flex-start' }} onPress={() => router.replace('/calendar' as Href)}>{t('actions.back')}</AppButton>
            <XStack gap="$sm" style={{ alignItems: 'center' }}><CalendarDays color="$accentStrong" size={28} /><Text color="$text" fontSize={28} fontWeight="600">{t('title')}</Text></XStack>
            <Text color="$textSecondary" lineHeight={22}>{t('description')}</Text>
          </YStack>

          {reviewing && preview ? (
            <Section title={t('actions.review')}>
              <XStack flexWrap="wrap" gap="$sm">
                <Choice active={targetKind === 'independent'} label={t('form.independent')} onPress={() => { setTargetKind('independent'); setOverwriteExisting(false); }} />
                <Choice active={targetKind === 'selection_step'} label={t('form.selection')} onPress={() => { setTargetKind('selection_step'); setOverwriteExisting(false); }} />
              </XStack>
              {targetKind === 'independent' ? <Field label={t('form.title')} value={title} onChange={setTitle} /> : (
                <YStack gap="$md">
                  <Text color="$text" fontWeight="600">{t('form.application')}</Text>
                  {targets.length === 0 ? <Text color="$textMuted">{t('form.noApplications')}</Text> : (
                    <XStack flexWrap="wrap" gap="$sm">{targets.map((target) => <Choice key={target.applicationId} active={target.applicationId === applicationId} label={`${target.companyName} · ${target.jobTitle}`} onPress={() => { setApplicationId(target.applicationId); setSelectionStepId(null); setOverwriteExisting(false); }} />)}</XStack>
                  )}
                  {selectedApplication ? <><Text color="$text" fontWeight="600">{t('form.step')}</Text>{selectedApplication.steps.length === 0 ? <Text color="$textMuted">{t('form.noSteps')}</Text> : <XStack flexWrap="wrap" gap="$sm">{selectedApplication.steps.map((step) => <Choice key={step.selectionStepId} active={step.selectionStepId === selectionStepId} label={step.name} onPress={() => { setSelectionStepId(step.selectionStepId); setOverwriteExisting(false); }} />)}</XStack>}</> : null}
                </YStack>
              )}
              {targetKind === 'selection_step' && selectedStep?.event ? (
                <YStack bg="$warningSoft" borderColor="$warningStrong" borderWidth={1} gap="$sm" p="$md" style={{ borderRadius: 12 }}>
                  <Text color="$text" fontWeight="600">{t('conflict.title')}</Text><Text color="$textSecondary" fontSize={13}>{t('conflict.description')}</Text>
                  <Comparison label={t('conflict.existing')} value={new Date(selectedStep.event.datetime).toLocaleString(i18n.language, { timeZone: 'Asia/Tokyo' })} />
                  <Comparison label={t('conflict.candidate')} value={`${date}${time ? ` ${time}` : ''}`} />
                  <Choice active={overwriteExisting} label={t('conflict.overwrite')} onPress={() => setOverwriteExisting(!overwriteExisting)} />
                </YStack>
              ) : null}
              <YStack gap="$sm"><Text color="$text" fontWeight="600">{t('form.timingType')}</Text><XStack gap="$sm"><Choice active={timingType === 'scheduled'} label={t('form.scheduled')} onPress={() => setTimingType('scheduled')} /><Choice active={timingType === 'deadline'} label={t('form.deadline')} onPress={() => setTimingType('deadline')} /></XStack></YStack>
              <XStack flexDirection={media.sm ? 'row' : 'column'} gap="$sm"><Field flex label={t('form.date')} type="date" value={date} onChange={setDate} /><Field flex label={t('form.time')} type="time" value={time} onChange={setTime} /></XStack>
              <Field label={t('form.location')} value={location} onChange={setLocation} />
              <Field label={t('form.meetingUrl')} value={meetingUrl} onChange={setMeetingUrl} />
              <Field label={t('form.note')} multiline value={note} onChange={setNote} />
              {preview.linkedEventId ? <Text color="$danger">{t('states.alreadyImported')}</Text> : null}
              {error ? <Text color="$danger">{error}</Text> : null}
              <XStack flexWrap="wrap" gap="$sm" style={{ justifyContent: 'flex-end' }}><AppButton onPress={() => setReviewing(false)}>{t('common:actions.back')}</AppButton><AppButton disabled={invalid || busy === 'import'} variant="primary" onPress={() => void commitImport()}>{busy === 'import' ? t('actions.importing') : t('actions.import')}</AppButton></XStack>
            </Section>
          ) : (
            <>
              <Section title={t('calendars.label')}>
                {busy === 'calendars' ? <Spinner color="$accentStrong" /> : calendars.length === 0 ? <Text color="$textMuted">{t('states.emptyCalendars')}</Text> : <XStack flexWrap="wrap" gap="$sm">{calendars.map((calendar) => <Choice key={calendar.id} active={calendar.id === calendarId} disabled={!calendar.readable} label={`${calendar.summary}${calendar.primary ? ` · ${t('calendars.primary')}` : ''}${!calendar.readable ? ` · ${t('calendars.noRead')}` : ''}`} onPress={() => { setCalendarId(calendar.id); setEvents([]); setPreview(null); }} />)}</XStack>}
                <XStack flexDirection={media.sm ? 'row' : 'column'} gap="$sm"><Field flex label={t('filters.from')} type="date" value={fromDate} onChange={setFromDate} /><Field flex label={t('filters.to')} type="date" value={toDate} onChange={setToDate} /></XStack>
                <AppButton disabled={!calendarId || busy === 'events'} variant="primary" style={{ alignSelf: 'flex-start' }} onPress={() => void loadEventPage()}>{busy === 'events' ? t('states.loading') : t('actions.loadEvents')}</AppButton>
              </Section>
              <YStack flexDirection={media.lg ? 'row' : 'column'} gap="$base" width="100%">
                <Section flex={Boolean(media.lg)} title={t('calendars.label')}>
                  <YStack maxH={520} minH={240} style={{ overflow: 'hidden' }}><ScrollView>{events.length === 0 ? <Text color="$textMuted">{t('states.emptyEvents')}</Text> : <YStack gap="$sm">{events.map((event) => <YStack key={event.googleEventId} bg={selectedEventId === event.googleEventId ? '$accentSoft' : '$surfaceMuted'} borderColor={selectedEventId === event.googleEventId ? '$accentStrong' : '$border'} borderWidth={1} cursor="pointer" gap="$xs" p="$md" onPress={() => void selectEvent(event)} style={{ borderRadius: 12 }}><Text color="$text" fontWeight="600">{event.summary || t('preview.noTitle')}</Text><Text color="$textSecondary" fontSize={13}>{eventLabel(event, i18n.language)}</Text></YStack>)}</YStack>}</ScrollView></YStack>
                  {nextPageToken ? <AppButton disabled={busy === 'more'} onPress={() => void loadEventPage(true)}>{busy === 'more' ? t('actions.loadingMore') : t('actions.loadMore')}</AppButton> : null}
                </Section>
                <Section flex={Boolean(media.lg)} title={t('preview.title')}>
                  {busy === 'preview' ? <Spinner color="$accentStrong" /> : preview ? <YStack gap="$sm"><Text color="$text" fontSize={17} fontWeight="600">{preview.summary || t('preview.noTitle')}</Text><Text color="$textSecondary">{preview.allDay ? `${preview.startDate} · ${t('preview.allDay')}` : eventLabel(preview, i18n.language)}</Text>{preview.location ? <Comparison label={t('form.location')} value={preview.location} /> : null}{preview.meetingUrl ? <Comparison label={t('form.meetingUrl')} value={preview.meetingUrl} /> : null}{preview.description ? <Text color="$textSecondary" lineHeight={21}>{preview.description}</Text> : null}{preview.linkedEventId ? <Text color="$danger">{t('states.alreadyImported')}</Text> : null}<AppButton disabled={Boolean(preview.linkedEventId)} variant="primary" onPress={() => setReviewing(true)}>{t('actions.review')}</AppButton></YStack> : <Text color="$textMuted">{t('preview.empty')}</Text>}
                </Section>
              </YStack>
              {error ? <Text color="$danger">{error}</Text> : null}
            </>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

function Section({ children, flex, title }: { children: React.ReactNode; flex?: boolean; title: string }) {
  return <YStack bg="$surface" borderColor="$border" borderWidth={1} flex={flex ? 1 : undefined} gap="$md" minW={0} p="$base" width={flex ? undefined : '100%'} style={{ borderRadius: 16 }}>{<Text color="$text" fontSize={17} fontWeight="600">{title}</Text>}{children}</YStack>;
}

function Field({ flex, label, multiline, onChange, type, value }: { flex?: boolean; label: string; multiline?: boolean; onChange: (value: string) => void; type?: 'date' | 'time'; value: string }) {
  return <YStack flex={flex ? 1 : undefined} gap="$xs"><Label color="$textSecondary" fontSize={12}>{label}</Label><AppInput aria-label={label} minH={multiline ? 88 : undefined} multiline={multiline} type={type} value={value} onChangeText={onChange} /></YStack>;
}

function Choice({ active, disabled, label, onPress }: { active: boolean; disabled?: boolean; label: string; onPress: () => void }) {
  return <AppButton disabled={disabled} variant={active ? 'primary' : 'secondary'} onPress={onPress}>{label}</AppButton>;
}

function Comparison({ label, value }: { label: string; value: string }) {
  return <XStack gap="$sm"><Text color="$textMuted" fontSize={12}>{label}</Text><Text color="$text" flex={1} fontSize={13}>{value}</Text></XStack>;
}

function CenteredState({ action, error, icon, text }: { action?: React.ReactNode; error?: boolean; icon?: React.ReactNode; text: string }) {
  return <YStack bg="$background" flex={1} p="$base" style={{ alignItems: 'center', justifyContent: 'center' }}><YStack bg="$surface" borderColor="$border" borderWidth={1} gap="$md" maxW={520} p="$xl" width="100%" style={{ alignItems: 'center', borderRadius: 18 }}>{icon ?? (error ? <CalendarDays color="$danger" size={34} /> : <Spinner color="$accentStrong" size="large" />)}<Text color={error ? '$danger' : '$text'} fontSize={16} fontWeight="600" style={{ textAlign: 'center' }}>{text}</Text>{action}</YStack></YStack>;
}
