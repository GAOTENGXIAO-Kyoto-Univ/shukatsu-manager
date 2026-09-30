import { CalendarPlus, CheckCircle2 } from '@tamagui/lucide-icons-2';
import { useAction, useQuery_experimental as useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner, Text, XStack, YStack } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { startGoogleOAuth } from '@/lib/googleOAuthFlow';

type CalendarList = FunctionReturnType<typeof api.googleCalendar.listCalendars>;

function getErrorCode(error: unknown) {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === 'object' && data && 'code' in data) {
      return String((data as { code: unknown }).code);
    }
  }
  return error instanceof Error ? error.message : '';
}

export function GoogleCalendarExportOverlay({
  eventId,
  onClose,
  open,
}: {
  eventId: Id<'events'> | null;
  onClose: () => void;
  open: boolean;
}) {
  const { t } = useTranslation(['googleCalendar', 'common']);
  const candidateState = useQuery({
    query: api.googleCalendar.getExportCandidate,
    args: open && eventId ? { eventId } : 'skip',
  });
  const beginAuthorization = useAction(api.googleOAuth.beginCalendarAuthorization);
  const listCalendars = useAction(api.googleCalendar.listCalendars);
  const addEvent = useAction(api.googleCalendar.addEventToGoogle);
  const loadedForEvent = useRef<string | null>(null);
  const [calendars, setCalendars] = useState<CalendarList>([]);
  const [calendarId, setCalendarId] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [busy, setBusy] = useState<'authorize' | 'calendars' | 'export' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const candidate = candidateState.status === 'success' ? candidateState.data : null;

  useEffect(() => {
    if (!candidate || !eventId) return;
    if (
      loadedForEvent.current === eventId ||
      !candidate.calendarEnabled ||
      !candidate.hasCalendarWriteScope ||
      candidate.credentialStatus !== 'active'
    ) return;
    loadedForEvent.current = eventId;
    setBusy('calendars');
    void listCalendars({})
      .then((result) => {
        setCalendars(result);
        setCalendarId(result.find((calendar) => calendar.primary && calendar.writable)?.id ?? result.find((calendar) => calendar.writable)?.id ?? '');
      })
      .catch(() => setError(t('errors.calendars')))
      .finally(() => setBusy(null));
  }, [candidate, eventId, listCalendars, t]);

  function close() {
    if (busy) return;
    loadedForEvent.current = null;
    setCalendars([]);
    setCalendarId('');
    setEndDate('');
    setEndTime('');
    setError(null);
    setSuccess(false);
    onClose();
  }

  async function authorizeWrite() {
    setBusy('authorize');
    setError(null);
    try {
      const result = await beginAuthorization({ access: 'write' });
      startGoogleOAuth(
        result.authorizationUrl,
        `${window.location.pathname}${window.location.search}`,
      );
    } catch {
      setError(t('errors.connection'));
      setBusy(null);
    }
  }

  async function exportEvent() {
    if (!eventId || !calendarId || !candidate) return;
    setBusy('export');
    setError(null);
    try {
      await addEvent({
        eventId,
        calendarId,
        ...(!candidate.allDay
          ? {
              endDate: endDate || candidate.endDate,
              endTime: endTime || candidate.endTime,
            }
          : {}),
      });
      setSuccess(true);
    } catch (caught) {
      const code = getErrorCode(caught);
      if (code.includes('PARTIAL_FAILURE') || code.includes('RESULT_UNKNOWN')) {
        setError(t('errors.partial'));
      } else if (code.includes('END_INVALID')) {
        setError(t('errors.invalidEnd'));
      } else if (code.includes('ALREADY_LINKED')) {
        setError(t('states.alreadyExported'));
      } else {
        setError(t('errors.export'));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <ResponsiveOverlay
      mobileNearFullscreen
      onClose={close}
      open={open}
      title={t('export.title')}
      width={560}
    >
      {candidateState.status === 'pending' ? (
        <YStack py="$xl" style={{ alignItems: 'center' }}><Spinner color="$accentStrong" /></YStack>
      ) : candidateState.status === 'error' || !candidate ? (
        <Text color="$danger">{t('errors.export')}</Text>
      ) : success ? (
        <YStack gap="$md" py="$xl" style={{ alignItems: 'center' }}>
          <CheckCircle2 color="$success" size={38} />
          <Text color="$text" fontSize={17} fontWeight="600">{t('states.exportSuccess')}</Text>
          <AppButton variant="primary" onPress={close}>{t('common:actions.close')}</AppButton>
        </YStack>
      ) : candidate.linked ? (
        <YStack gap="$md"><Text color="$textSecondary">{t('states.alreadyExported')}</Text><AppButton onPress={close}>{t('common:actions.close')}</AppButton></YStack>
      ) : !candidate.calendarEnabled || !candidate.hasCalendarWriteScope || candidate.credentialStatus !== 'active' ? (
        <YStack gap="$md">
          <Text color="$textSecondary" lineHeight={21}>{t('export.description')}</Text>
          <AppButton disabled={busy === 'authorize'} variant="primary" onPress={() => void authorizeWrite()}>{busy === 'authorize' ? t('profile.connecting') : t('actions.authorizeWrite')}</AppButton>
          {error ? <Text color="$danger">{error}</Text> : null}
        </YStack>
      ) : (
        <YStack gap="$base">
          <Text color="$textSecondary" lineHeight={21}>{t('export.description')}</Text>
          <Info label={t('export.eventTitle')} value={candidate.title} />
          <Info label={t('export.start')} value={`${candidate.date}${candidate.hasExplicitTime ? ` ${candidate.time}` : ''}`} />
          <YStack gap="$sm"><Text color="$text" fontWeight="600">{t('calendars.target')}</Text>{busy === 'calendars' ? <Spinner color="$accentStrong" /> : <XStack flexWrap="wrap" gap="$sm">{calendars.map((calendar) => <AppButton key={calendar.id} disabled={!calendar.writable} variant={calendar.id === calendarId ? 'primary' : 'secondary'} onPress={() => setCalendarId(calendar.id)}>{`${calendar.summary}${calendar.primary ? ` · ${t('calendars.primary')}` : ''}${!calendar.writable ? ` · ${t('calendars.noWrite')}` : ''}`}</AppButton>)}</XStack>}{!calendarId && busy !== 'calendars' ? <Text color="$danger" fontSize={13}>{t('export.chooseWritable')}</Text> : null}</YStack>
          {candidate.allDay ? <Text color="$textSecondary" fontSize={13}>{t('export.allDayHint')}</Text> : <XStack gap="$sm"><YStack flex={1} gap="$xs"><Text color="$textSecondary" fontSize={12}>{t('export.endDate')}</Text><AppInput type="date" value={endDate || candidate.endDate} onChangeText={setEndDate} /></YStack><YStack flex={1} gap="$xs"><Text color="$textSecondary" fontSize={12}>{t('export.endTime')}</Text><AppInput type="time" value={endTime || candidate.endTime} onChangeText={setEndTime} /></YStack></XStack>}
          {(candidate.location || candidate.note || candidate.meetingUrl) ? <Text color="$textMuted" fontSize={12}>{t('export.details')}</Text> : null}
          {error ? <Text color="$danger">{error}</Text> : null}
          <XStack flexWrap="wrap" gap="$sm" style={{ justifyContent: 'flex-end' }}><AppButton disabled={Boolean(busy)} onPress={close}>{t('common:actions.cancel')}</AppButton><AppButton icon={<CalendarPlus size={16} />} disabled={!calendarId || busy === 'export'} variant="primary" onPress={() => void exportEvent()}>{busy === 'export' ? t('actions.exporting') : t('actions.export')}</AppButton></XStack>
        </YStack>
      )}
    </ResponsiveOverlay>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <YStack gap="$xs"><Text color="$textMuted" fontSize={12}>{label}</Text><Text color="$text" fontWeight="600">{value}</Text></YStack>;
}
