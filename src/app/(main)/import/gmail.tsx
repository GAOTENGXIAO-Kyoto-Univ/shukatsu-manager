import { ArrowLeft, CheckCircle2, Mail, Search } from '@tamagui/lucide-icons-2';
import { useAction, useMutation, useQuery_experimental as useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { Checkbox, Label, Spinner, Text, XStack, YStack, useMedia } from 'tamagui';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import type { StepType } from '../../../../convex/lib/gmailParser';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import {
  matchApplicationCandidate,
  matchCompanyCandidate,
  matchSelectionStepCandidate,
} from '@/lib/gmailMatching';

type MessageListResult = FunctionReturnType<typeof api.gmail.listMessages>;
type MessageSummary = MessageListResult['messages'][number];
type ParsedResult = FunctionReturnType<typeof api.gmail.parseSelectedMessage>;
type MatchContext = FunctionReturnType<typeof api.gmailImport.getMatchContext>;
type CompanyContext = MatchContext[number];
type ApplicationContext = CompanyContext['applications'][number];
type StepContext = ApplicationContext['steps'][number];
type TimingType = 'scheduled' | 'deadline';

type SecondaryDraft = {
  selected: boolean;
  title: string;
  date: string;
  time: string;
  timingType: TimingType;
  location: string;
};

const stepTypes: StepType[] = [
  'es',
  'web_test',
  'interview',
  'briefing',
  'group_discussion',
  'offer_meeting',
  'other',
];

function getErrorCode(error: unknown) {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === 'object' && data && 'code' in data) {
      return String((data as { code: unknown }).code);
    }
  }
  return error instanceof Error ? error.message : '';
}

function toExpectedTimestamp(date: string, time: string, timingType: TimingType) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/u.exec(time);
  if (!dateMatch || (timingType === 'scheduled' && !timeMatch)) return null;
  const hour = timeMatch ? Number(timeMatch[1]) : 23;
  const minute = timeMatch ? Number(timeMatch[2]) : 59;
  const second = timeMatch ? 0 : 59;
  const millisecond = timeMatch ? 0 : 999;
  return Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    hour,
    minute,
    second,
    millisecond,
  ) - 9 * 60 * 60 * 1000;
}

export default function GmailImportScreen() {
  const { t, i18n } = useTranslation(['gmail', 'selection', 'common']);
  const router = useRouter();
  const media = useMedia();
  const connection = useQuery({ query: api.googleConnections.current, args: {} });
  const matchContextState = useQuery({ query: api.gmailImport.getMatchContext, args: {} });
  const listMessages = useAction(api.gmail.listMessages);
  const getPreview = useAction(api.gmail.getMessagePreview);
  const parseMessage = useAction(api.gmail.parseSelectedMessage);
  const commitImport = useMutation(api.gmailImport.commit);

  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedResult['message'] | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [busy, setBusy] = useState<'list' | 'more' | 'preview' | 'parse' | 'commit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedInitial = useRef(false);

  const [companyMode, setCompanyMode] = useState<'unset' | 'existing' | 'new'>('unset');
  const [companyId, setCompanyId] = useState<Id<'companies'> | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [applicationMode, setApplicationMode] = useState<'unset' | 'existing' | 'new'>('unset');
  const [applicationId, setApplicationId] = useState<Id<'applications'> | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [applicationFilter, setApplicationFilter] = useState('');
  const [targetMode, setTargetMode] = useState<'none' | 'existing' | 'new'>('none');
  const [targetStepId, setTargetStepId] = useState<Id<'selectionSteps'> | null>(null);
  const [targetName, setTargetName] = useState('');
  const [targetType, setTargetType] = useState<StepType>('other');
  const [historicalEnabled, setHistoricalEnabled] = useState(false);
  const [historicalMode, setHistoricalMode] = useState<'existing' | 'new'>('new');
  const [historicalStepId, setHistoricalStepId] = useState<Id<'selectionSteps'> | null>(null);
  const [historicalName, setHistoricalName] = useState('');
  const [historicalType, setHistoricalType] = useState<StepType>('other');
  const [historicalInsertionIndex, setHistoricalInsertionIndex] = useState('0');
  const [applyResult, setApplyResult] = useState(false);
  const [historicalResult, setHistoricalResult] = useState<'passed' | 'failed'>('passed');
  const [mainEnabled, setMainEnabled] = useState(false);
  const [mainDate, setMainDate] = useState('');
  const [mainTime, setMainTime] = useState('');
  const [mainTimingType, setMainTimingType] = useState<TimingType>('scheduled');
  const [mainLocation, setMainLocation] = useState('');
  const [mainResolution, setMainResolution] = useState<'create' | 'noop' | 'keep' | 'update'>('create');
  const [secondaryDrafts, setSecondaryDrafts] = useState<SecondaryDraft[]>([]);
  const [success, setSuccess] = useState<FunctionReturnType<typeof api.gmailImport.commit> | null>(null);

  const companies = matchContextState.status === 'success' ? matchContextState.data : [];
  const selectedCompany = companies.find((company) => company.companyId === companyId) ?? null;
  const applications = selectedCompany?.applications ?? [];
  const selectedApplication = applications.find((application) => application.applicationId === applicationId) ?? null;
  const steps = selectedApplication?.steps ?? [];
  const selectedTarget = steps.find((step) => step.selectionStepId === targetStepId) ?? null;
  const filteredCompanies = companies.filter((company) =>
    company.name.toLocaleLowerCase().includes(companyFilter.trim().toLocaleLowerCase()),
  );
  const filteredApplications = applications.filter((application) =>
    application.jobTitle.toLocaleLowerCase().includes(applicationFilter.trim().toLocaleLowerCase()),
  );
  const connectionReady = connection.status === 'success' &&
    connection.data?.gmailEnabled === true &&
    connection.data.credentialStatus === 'active';

  async function loadMessages(pageToken?: string) {
    setBusy(pageToken ? 'more' : 'list');
    setError(null);
    try {
      const result = await listMessages({
        ...(searchQuery.trim() ? { query: searchQuery.trim() } : {}),
        ...(pageToken ? { pageToken } : {}),
      });
      setMessages((current) => pageToken ? [...current, ...result.messages] : result.messages);
      setNextPageToken(result.nextPageToken);
    } catch (caught) {
      const code = getErrorCode(caught);
      setError(code.includes('REAUTH') ? t('gmail:errors.reauth') : t('gmail:errors.list'));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (
      loadedInitial.current ||
      !connectionReady
    ) return;
    loadedInitial.current = true;
    void loadMessages();
    // Initial loading intentionally ignores the editable search query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionReady]);

  async function selectMessage(messageId: string) {
    setSelectedMessageId(messageId);
    setPreview(null);
    setParsedResult(null);
    setError(null);
    setBusy('preview');
    try {
      setPreview(await getPreview({ messageId }));
    } catch {
      setError(t('gmail:errors.preview'));
    } finally {
      setBusy(null);
    }
  }

  function chooseCompany(nextCompany: CompanyContext) {
    setCompanyMode('existing');
    setCompanyId(nextCompany.companyId);
    setApplicationMode('unset');
    setApplicationId(null);
    setTargetMode('none');
    setTargetStepId(null);
    setHistoricalStepId(null);
    setHistoricalInsertionIndex('0');
  }

  function chooseApplication(nextApplication: ApplicationContext) {
    setApplicationMode('existing');
    setApplicationId(nextApplication.applicationId);
    setTargetMode('none');
    setTargetStepId(null);
    setHistoricalStepId(null);
  }

  function calculateResolution(step: StepContext | null, date: string, time: string, timingType: TimingType) {
    if (!step?.event) return 'create' as const;
    const timestamp = toExpectedTimestamp(date, time, timingType);
    return timestamp !== null &&
      timestamp === step.event.datetime &&
      timingType === step.event.timingType &&
      Boolean(time) === step.event.hasExplicitTime
      ? 'noop' as const
      : 'keep' as const;
  }

  function chooseTarget(step: StepContext) {
    setTargetMode('existing');
    setTargetStepId(step.selectionStepId);
    setMainResolution(calculateResolution(step, mainDate, mainTime, mainTimingType));
  }

  function initializeConfirmation(result: ParsedResult, context: MatchContext) {
    const companyMatch = matchCompanyCandidate(result.parsed.companyCandidate?.value, context);
    const exactCompany = companyMatch.kind === 'exact' ? companyMatch.matches[0] : null;
    if (exactCompany) {
      setCompanyMode('existing');
      setCompanyId(exactCompany.companyId);
    } else {
      setCompanyMode('unset');
      setCompanyId(null);
    }
    setCompanyName(result.parsed.companyCandidate?.value ?? '');

    const candidateApplications = exactCompany?.applications ?? [];
    const applicationMatch = matchApplicationCandidate(result.parsed.jobCandidate?.value, candidateApplications);
    const exactApplication = applicationMatch.kind === 'exact' ? applicationMatch.matches[0] : null;
    if (exactApplication) {
      setApplicationMode('existing');
      setApplicationId(exactApplication.applicationId);
    } else {
      setApplicationMode('unset');
      setApplicationId(null);
    }
    setJobTitle(result.parsed.jobCandidate?.value ?? '');

    const candidateSteps = exactApplication?.steps ?? [];
    const targetCandidate = result.parsed.targetStepCandidates[0];
    const targetMatch = matchSelectionStepCandidate(targetCandidate?.name, candidateSteps);
    const exactTarget = targetMatch.kind === 'exact' ? targetMatch.matches[0] : null;
    if (exactTarget) {
      setTargetMode('existing');
      setTargetStepId(exactTarget.selectionStepId);
    } else {
      setTargetMode('none');
      setTargetStepId(null);
    }
    setTargetName(targetCandidate?.name ?? '');
    setTargetType(targetCandidate?.type ?? 'other');

    const historyCandidate = result.parsed.historicalStepCandidates[0];
    const historyMatch = matchSelectionStepCandidate(historyCandidate?.name, candidateSteps);
    const exactHistory = historyMatch.kind === 'exact' ? historyMatch.matches[0] : null;
    const shouldApplyHistory = Boolean(
      exactHistory &&
      historyCandidate?.resultExplicit &&
      historyCandidate.result &&
      (exactHistory.result === null || exactHistory.result === historyCandidate.result),
    );
    setHistoricalEnabled(shouldApplyHistory);
    setHistoricalMode(exactHistory ? 'existing' : 'new');
    setHistoricalStepId(exactHistory?.selectionStepId ?? null);
    setHistoricalName(historyCandidate?.name ?? '');
    setHistoricalType(historyCandidate?.type ?? 'other');
    setHistoricalResult(historyCandidate?.result ?? 'passed');
    setApplyResult(shouldApplyHistory);
    setHistoricalInsertionIndex(String(exactTarget?.order ?? candidateSteps.length));

    const main = result.parsed.mainTimeCandidate;
    setMainEnabled(Boolean(main && exactTarget));
    setMainDate(main?.date ?? '');
    setMainTime(main?.time ?? '');
    setMainTimingType(main?.timingType ?? 'scheduled');
    setMainLocation(result.parsed.locationCandidate?.value ?? '');
    setMainResolution(calculateResolution(exactTarget, main?.date ?? '', main?.time ?? '', main?.timingType ?? 'scheduled'));
    setSecondaryDrafts(result.parsed.secondaryTimeCandidates.map((candidate) => ({
      selected: false,
      title: candidate.label ?? t('gmail:confirm.secondaryDefaultTitle'),
      date: candidate.date,
      time: candidate.time ?? '',
      timingType: candidate.timingType,
      location: '',
    })));
  }

  async function prepareImport() {
    if (!selectedMessageId || matchContextState.status !== 'success') return;
    setBusy('parse');
    setError(null);
    try {
      const result = await parseMessage({ messageId: selectedMessageId });
      initializeConfirmation(result, matchContextState.data);
      setParsedResult(result);
    } catch {
      setError(t('gmail:errors.parse'));
    } finally {
      setBusy(null);
    }
  }

  const canCommit = useMemo(() => {
    const companyReady = companyMode === 'existing'
      ? Boolean(companyId)
      : companyMode === 'new' && Boolean(companyName.trim());
    const applicationReady = applicationMode === 'existing'
      ? Boolean(applicationId)
      : applicationMode === 'new' && Boolean(jobTitle.trim());
    const targetReady = targetMode === 'none' || targetMode === 'existing'
      ? targetMode === 'none' || Boolean(targetStepId)
      : Boolean(targetName.trim());
    const mainReady = !mainEnabled || (
      targetMode !== 'none' && Boolean(mainDate) &&
      (mainTimingType === 'deadline' || Boolean(mainTime))
    );
    const historyReady = !historicalEnabled || (
      (historicalMode === 'existing'
        ? Boolean(historicalStepId)
        : Boolean(historicalName.trim()) && /^\d+$/u.test(historicalInsertionIndex)) &&
      (!applyResult || Boolean(historicalResult))
    );
    const secondaryReady = secondaryDrafts.every((draft) =>
      !draft.selected || (
        Boolean(draft.title.trim()) &&
        Boolean(draft.date) &&
        (draft.timingType === 'deadline' || Boolean(draft.time))
      ),
    );
    return companyReady && applicationReady && targetReady && mainReady && historyReady && secondaryReady;
  }, [
    applicationId, applicationMode, applyResult, companyId, companyMode, companyName,
    historicalEnabled, historicalInsertionIndex, historicalMode, historicalName, historicalResult, historicalStepId,
    jobTitle, mainDate, mainEnabled, mainTime, mainTimingType, secondaryDrafts,
    targetMode, targetName, targetStepId,
  ]);

  async function commit() {
    const company = companyMode === 'existing'
      ? companies.find((item) => item.companyId === companyId)
      : null;
    const application = applicationMode === 'existing'
      ? applications.find((item) => item.applicationId === applicationId)
      : null;
    const target = targetMode === 'existing'
      ? steps.find((item) => item.selectionStepId === targetStepId)
      : null;
    const historical = historicalMode === 'existing'
      ? steps.find((item) => item.selectionStepId === historicalStepId)
      : null;
    if (!canCommit || companyMode === 'unset' || applicationMode === 'unset' ||
      (companyMode === 'existing' && !company) ||
      (applicationMode === 'existing' && !application) ||
      (targetMode === 'existing' && !target) ||
      (historicalEnabled && historicalMode === 'existing' && !historical)) return;

    setBusy('commit');
    setError(null);
    try {
      const result = await commitImport({
        company: company
          ? { kind: 'existing', companyId: company.companyId, expectedUpdatedAt: company.updatedAt }
          : { kind: 'new', name: companyName },
        application: application
          ? { kind: 'existing', applicationId: application.applicationId, expectedUpdatedAt: application.updatedAt }
          : { kind: 'new', jobTitle },
        ...(targetMode === 'none'
          ? {}
          : target
            ? { targetStep: { kind: 'existing' as const, selectionStepId: target.selectionStepId, expectedUpdatedAt: target.updatedAt } }
            : { targetStep: { kind: 'new' as const, name: targetName, type: targetType } }),
        ...(historicalEnabled
          ? {
              historicalStep: {
                step: historical
                  ? { kind: 'existing' as const, selectionStepId: historical.selectionStepId, expectedUpdatedAt: historical.updatedAt }
                  : { kind: 'new' as const, name: historicalName, type: historicalType },
                ...(historicalMode === 'new'
                  ? { insertionIndex: Number.parseInt(historicalInsertionIndex, 10) }
                  : {}),
                applyResult,
                ...(applyResult ? { result: historicalResult } : {}),
              },
            }
          : {}),
        ...(mainEnabled && targetMode !== 'none'
          ? {
              mainEvent: {
                date: mainDate,
                time: mainTime || null,
                timingType: mainTimingType,
                location: mainLocation || null,
                resolution: mainResolution,
                ...(target?.event
                  ? {
                      expectedEventId: target.event.eventId,
                      expectedEventUpdatedAt: target.event.updatedAt,
                    }
                  : {}),
              },
            }
          : {}),
        secondaryEvents: secondaryDrafts
          .filter((draft) => draft.selected)
          .map((draft) => ({
            title: draft.title,
            date: draft.date,
            time: draft.time || null,
            timingType: draft.timingType,
            location: draft.location || null,
          })),
      });
      setSuccess(result);
    } catch (caught) {
      const code = getErrorCode(caught);
      setError(code.includes('GMAIL_IMPORT_STALE') ? t('gmail:errors.stale') : t('gmail:errors.commit'));
    } finally {
      setBusy(null);
    }
  }

  function updateSecondary(index: number, patch: Partial<SecondaryDraft>) {
    setSecondaryDrafts((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    ));
  }

  const pageWidth = media.md ? 920 : '100%';

  if (connection.status === 'pending' || matchContextState.status === 'pending') {
    return <CenteredState text={t('gmail:states.loading')} />;
  }
  if (connection.status === 'error' || matchContextState.status === 'error') {
    return <CenteredState error text={t('gmail:errors.load')} />;
  }
  if (!connection.data?.gmailEnabled || connection.data.credentialStatus !== 'active') {
    return (
      <CenteredState
        error
        text={connection.data?.credentialStatus === 'reauth_required'
          ? t('gmail:errors.reauth')
          : t('gmail:states.notConnected')}
        action={<AppButton variant="primary" onPress={() => router.replace('/profile')}>{t('gmail:actions.profile')}</AppButton>}
      />
    );
  }
  if (success) {
    return (
      <CenteredState
        icon={<CheckCircle2 color="$success" size={40} />}
        text={t('gmail:success.title')}
        detail={t('gmail:success.description', { company: success.companyName, job: success.jobTitle })}
        action={(
          <XStack flexWrap="wrap" gap="$sm" style={{ justifyContent: 'center' }}>
            <AppButton variant="primary" onPress={() => router.replace(`/applications/${success.applicationId}` as Href)}>
              {t('gmail:success.openApplication')}
            </AppButton>
            <AppButton onPress={() => router.replace('/profile')}>{t('gmail:success.done')}</AppButton>
          </XStack>
        )}
      />
    );
  }

  return (
    <YStack bg="$background" flex={1}>
      <ScrollView style={{ flex: 1 }}>
        <YStack gap="$lg" maxW={pageWidth} p={media.md ? '$xl' : '$base'} pb="$xxl" width="100%" style={{ alignSelf: 'center' }}>
          <XStack gap="$md" style={{ alignItems: 'center' }}>
            <AppButton aria-label={t('common:actions.back')} icon={<ArrowLeft size={18} />} variant="ghost" onPress={() => parsedResult ? setParsedResult(null) : router.back()} />
            <YStack flex={1}>
              <Text color="$text" fontSize={media.md ? 30 : 25} fontWeight="600">{t('gmail:title')}</Text>
              <Text color="$textSecondary" fontSize={14}>{t('gmail:description')}</Text>
            </YStack>
          </XStack>

          {parsedResult ? (
            <YStack gap="$lg">
              <Section title={t('gmail:confirm.reviewTitle')} description={t('gmail:confirm.reviewDescription')}>
                <Evidence label={t('gmail:confirm.mailSubject')} value={parsedResult.message.subject} />
                <Evidence label={t('gmail:confirm.mailFrom')} value={parsedResult.message.from} />
              </Section>

              <Section title={t('gmail:confirm.companyTitle')} description={t('gmail:confirm.chooseExistingOrNew')}>
                <ModeButtons
                  firstActive={companyMode === 'existing'}
                  secondActive={companyMode === 'new'}
                  firstLabel={t('gmail:confirm.existing')}
                  secondLabel={t('gmail:confirm.createNew')}
                  onFirst={() => { setCompanyMode('existing'); setApplicationMode('unset'); setApplicationId(null); setTargetMode('none'); }}
                  onSecond={() => { setCompanyMode('new'); setCompanyId(null); setApplicationMode('unset'); setApplicationId(null); setTargetMode('none'); }}
                />
                {companyMode === 'existing' ? (
                  <YStack gap="$sm">
                    <Field label={t('gmail:confirm.searchCompanies')} value={companyFilter} onChange={setCompanyFilter} />
                    <ChoiceList
                      empty={t('gmail:confirm.noCompanies')}
                      items={filteredCompanies.map((company) => ({ id: company.companyId, label: company.name }))}
                      selectedId={companyId}
                      onSelect={(id) => {
                        const company = companies.find((item) => item.companyId === id);
                        if (company) chooseCompany(company);
                      }}
                    />
                  </YStack>
                ) : companyMode === 'new' ? <Field label={t('gmail:confirm.companyName')} value={companyName} onChange={setCompanyName} /> : null}
                {parsedResult.parsed.companyCandidate ? <SourceSnippet text={parsedResult.parsed.companyCandidate.sourceSnippet} /> : null}
              </Section>

              <Section title={t('gmail:confirm.applicationTitle')}>
                <ModeButtons
                  firstActive={applicationMode === 'existing'}
                  secondActive={applicationMode === 'new'}
                  firstLabel={t('gmail:confirm.existing')}
                  secondLabel={t('gmail:confirm.createNew')}
                  onFirst={() => { setApplicationMode('existing'); setTargetMode('none'); setTargetStepId(null); }}
                  onSecond={() => { setApplicationMode('new'); setApplicationId(null); setTargetMode('none'); }}
                />
                {applicationMode === 'existing' ? (
                  <YStack gap="$sm">
                    <Field label={t('gmail:confirm.searchApplications')} value={applicationFilter} onChange={setApplicationFilter} />
                    <ChoiceList
                      empty={companyMode !== 'existing' ? t('gmail:confirm.chooseExistingCompany') : t('gmail:confirm.noApplications')}
                      items={filteredApplications.map((application) => ({ id: application.applicationId, label: application.jobTitle }))}
                      selectedId={applicationId}
                      onSelect={(id) => {
                        const application = applications.find((item) => item.applicationId === id);
                        if (application) chooseApplication(application);
                      }}
                    />
                  </YStack>
                ) : applicationMode === 'new' ? <Field label={t('gmail:confirm.jobTitle')} value={jobTitle} onChange={setJobTitle} /> : null}
              </Section>

              <Section title={t('gmail:confirm.targetStepTitle')} description={t('gmail:confirm.optional')}>
                <XStack flexWrap="wrap" gap="$sm">
                  <ChoiceButton active={targetMode === 'none'} label={t('gmail:confirm.doNotImport')} onPress={() => { setTargetMode('none'); setTargetStepId(null); }} />
                  <ChoiceButton active={targetMode === 'existing'} label={t('gmail:confirm.existing')} onPress={() => setTargetMode('existing')} />
                  <ChoiceButton active={targetMode === 'new'} label={t('gmail:confirm.createNew')} onPress={() => { setTargetMode('new'); setTargetStepId(null); setMainResolution('create'); }} />
                </XStack>
                {targetMode === 'existing' ? (
                  <ChoiceList
                    empty={t('gmail:confirm.noSteps')}
                    items={steps.map((step) => ({ id: step.selectionStepId, label: step.name }))}
                    selectedId={targetStepId}
                    onSelect={(id) => {
                      const step = steps.find((item) => item.selectionStepId === id);
                      if (step) chooseTarget(step);
                    }}
                  />
                ) : targetMode === 'new' ? (
                  <YStack gap="$sm">
                    <Field label={t('gmail:confirm.stepName')} value={targetName} onChange={setTargetName} />
                    <StepTypeChoices value={targetType} onChange={setTargetType} />
                  </YStack>
                ) : null}
                {parsedResult.parsed.targetStepCandidates[0] ? <SourceSnippet text={parsedResult.parsed.targetStepCandidates[0].sourceSnippet} /> : null}
              </Section>

              <Section title={t('gmail:confirm.historyTitle')} description={t('gmail:confirm.historyDescription')}>
                <CheckRow checked={historicalEnabled} label={t('gmail:confirm.importHistory')} onChange={setHistoricalEnabled} />
                {historicalEnabled ? (
                  <YStack gap="$sm">
                    <ModeButtons firstActive={historicalMode === 'existing'} firstLabel={t('gmail:confirm.existing')} secondLabel={t('gmail:confirm.createNew')} onFirst={() => setHistoricalMode('existing')} onSecond={() => { setHistoricalMode('new'); setHistoricalStepId(null); }} />
                    {historicalMode === 'existing' ? (
                      <ChoiceList empty={t('gmail:confirm.noSteps')} items={steps.map((step) => ({ id: step.selectionStepId, label: step.name }))} selectedId={historicalStepId} onSelect={(id) => setHistoricalStepId(id as Id<'selectionSteps'>)} />
                    ) : (
                      <YStack gap="$sm">
                        <Field label={t('gmail:confirm.stepName')} value={historicalName} onChange={setHistoricalName} />
                        <StepTypeChoices value={historicalType} onChange={setHistoricalType} />
                        <Field label={t('gmail:confirm.insertionPosition')} value={historicalInsertionIndex} onChange={setHistoricalInsertionIndex} placeholder="0" />
                      </YStack>
                    )}
                    <CheckRow checked={applyResult} label={t('gmail:confirm.applyResult')} onChange={setApplyResult} />
                    {applyResult ? (
                      <XStack gap="$sm">
                        <ChoiceButton active={historicalResult === 'passed'} label={t('selection:result.passed')} onPress={() => setHistoricalResult('passed')} />
                        <ChoiceButton active={historicalResult === 'failed'} label={t('selection:result.failed')} onPress={() => setHistoricalResult('failed')} />
                      </XStack>
                    ) : null}
                    {parsedResult.parsed.historicalStepCandidates[0] ? <SourceSnippet text={parsedResult.parsed.historicalStepCandidates[0].sourceSnippet} /> : null}
                  </YStack>
                ) : null}
              </Section>

              <Section title={t('gmail:confirm.mainEventTitle')} description={t('gmail:confirm.mainEventDescription')}>
                <CheckRow checked={mainEnabled} label={t('gmail:confirm.importMainEvent')} onChange={setMainEnabled} />
                {mainEnabled ? (
                  <YStack gap="$sm">
                    <XStack flexDirection={media.sm ? 'row' : 'column'} gap="$sm">
                      <Field flex label={t('gmail:confirm.date')} value={mainDate} onChange={setMainDate} placeholder="YYYY-MM-DD" />
                      <Field flex label={t('gmail:confirm.time')} value={mainTime} onChange={setMainTime} placeholder="HH:mm" />
                    </XStack>
                    <TimingChoices value={mainTimingType} onChange={setMainTimingType} />
                    {!selectedTarget?.event ? <Field label={t('gmail:confirm.location')} value={mainLocation} onChange={setMainLocation} /> : null}
                    {selectedTarget?.event && mainResolution !== 'noop' ? (
                      <YStack bg="$warningSoft" gap="$sm" p="$md" style={{ borderRadius: 12 }}>
                        <Text color="$text" fontSize={13} fontWeight="600">{t('gmail:confirm.eventConflict')}</Text>
                        <XStack flexWrap="wrap" gap="$sm">
                          <ChoiceButton active={mainResolution === 'keep'} label={t('gmail:confirm.keepExisting')} onPress={() => setMainResolution('keep')} />
                          <ChoiceButton active={mainResolution === 'update'} label={t('gmail:confirm.replaceExisting')} onPress={() => setMainResolution('update')} />
                        </XStack>
                      </YStack>
                    ) : null}
                    {parsedResult.parsed.mainTimeCandidate ? <SourceSnippet text={parsedResult.parsed.mainTimeCandidate.sourceSnippet} /> : null}
                  </YStack>
                ) : null}
              </Section>

              {secondaryDrafts.length > 0 ? (
                <Section title={t('gmail:confirm.secondaryTitle')} description={t('gmail:confirm.secondaryDescription')}>
                  {secondaryDrafts.map((draft, index) => (
                    <YStack key={`${draft.date}-${index}`} borderColor="$border" borderTopWidth={index ? 1 : 0} gap="$sm" py="$sm">
                      <CheckRow checked={draft.selected} label={draft.title} onChange={(selected) => updateSecondary(index, { selected })} />
                      {draft.selected ? (
                        <YStack gap="$sm">
                          <Field label={t('gmail:confirm.eventTitle')} value={draft.title} onChange={(title) => updateSecondary(index, { title })} />
                          <XStack flexDirection={media.sm ? 'row' : 'column'} gap="$sm">
                            <Field flex label={t('gmail:confirm.date')} value={draft.date} onChange={(date) => updateSecondary(index, { date })} />
                            <Field flex label={t('gmail:confirm.time')} value={draft.time} onChange={(time) => updateSecondary(index, { time })} />
                          </XStack>
                          <TimingChoices value={draft.timingType} onChange={(timingType) => updateSecondary(index, { timingType })} />
                        </YStack>
                      ) : null}
                    </YStack>
                  ))}
                </Section>
              ) : null}

              {error ? <Text color="$danger" fontSize={13}>{error}</Text> : null}
              <XStack flexWrap="wrap" gap="$sm" style={{ justifyContent: 'flex-end' }}>
                <AppButton disabled={busy === 'commit'} onPress={() => setParsedResult(null)}>{t('common:actions.back')}</AppButton>
                <AppButton disabled={!canCommit || busy === 'commit'} variant="primary" onPress={() => void commit()}>
                  {busy === 'commit' ? t('gmail:actions.importing') : t('gmail:actions.confirmImport')}
                </AppButton>
              </XStack>
            </YStack>
          ) : (
            <>
              <Section title={t('gmail:search.title')} description={t('gmail:search.description')}>
                <XStack flexDirection={media.sm ? 'row' : 'column'} gap="$sm">
                  <AppInput flex={1} aria-label={t('gmail:search.label')} placeholder={t('gmail:search.placeholder')} value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={() => void loadMessages()} />
                  <AppButton disabled={busy === 'list'} icon={<Search size={17} />} variant="primary" onPress={() => void loadMessages()}>
                    {t('gmail:search.action')}
                  </AppButton>
                </XStack>
                <Text color="$textMuted" fontSize={12}>{t('gmail:search.syntaxHint')}</Text>
              </Section>

              {error ? <Text color="$danger" fontSize={13}>{error}</Text> : null}
              <YStack flexDirection={media.lg ? 'row' : 'column'} gap="$lg">
                <Section flex={Boolean(media.lg)} title={t('gmail:list.title')}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ height: 780 }}>
                    <YStack gap="$sm" pr="$xs">
                      {busy === 'list' ? <Spinner color="$accentStrong" /> : messages.length === 0 ? (
                        <Text color="$textMuted" fontSize={14}>{t('gmail:list.empty')}</Text>
                      ) : messages.map((message) => (
                        <AppButton key={message.messageId} height="auto" py="$md" variant={selectedMessageId === message.messageId ? 'primary' : 'ghost'} style={{ justifyContent: 'flex-start' }} onPress={() => void selectMessage(message.messageId)}>
                          <YStack flex={1} gap="$xs" style={{ alignItems: 'flex-start' }}>
                            <Text color={selectedMessageId === message.messageId ? '$surface' : '$text'} fontSize={14} fontWeight="600" numberOfLines={2}>{message.subject || t('gmail:list.noSubject')}</Text>
                            <Text color={selectedMessageId === message.messageId ? '$surface' : '$textSecondary'} fontSize={12} numberOfLines={1}>{message.from}</Text>
                            <Text color={selectedMessageId === message.messageId ? '$surface' : '$textMuted'} fontSize={12} numberOfLines={2}>{message.snippet}</Text>
                            <Text color={selectedMessageId === message.messageId ? '$surface' : '$textMuted'} fontSize={11}>{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(message.internalDate))}</Text>
                          </YStack>
                        </AppButton>
                      ))}
                      {nextPageToken ? <AppButton disabled={busy === 'more'} onPress={() => void loadMessages(nextPageToken)}>{busy === 'more' ? t('gmail:actions.loadingMore') : t('gmail:actions.loadMore')}</AppButton> : null}
                    </YStack>
                  </ScrollView>
                </Section>

                <Section flex={Boolean(media.lg)} title={t('gmail:preview.title')}>
                  {busy === 'preview' ? <Spinner color="$accentStrong" /> : preview ? (
                    <YStack gap="$sm">
                      <Evidence label={t('gmail:confirm.mailSubject')} value={preview.subject || t('gmail:list.noSubject')} />
                      <Evidence label={t('gmail:confirm.mailFrom')} value={preview.from} />
                      <YStack bg="$surfaceMuted" maxH={360} p="$md" style={{ borderRadius: 12, overflow: 'hidden' }}>
                        <ScrollView><Text color="$textSecondary" fontSize={13} lineHeight={21}>{preview.bodyText}</Text></ScrollView>
                      </YStack>
                      <Text color="$textMuted" fontSize={12}>{t('gmail:preview.privacy')}</Text>
                      <AppButton disabled={busy === 'parse'} variant="primary" onPress={() => void prepareImport()}>
                        {busy === 'parse' ? t('gmail:actions.parsing') : t('gmail:actions.prepare')}
                      </AppButton>
                    </YStack>
                  ) : <Text color="$textMuted" fontSize={14}>{t('gmail:preview.empty')}</Text>}
                </Section>
              </YStack>
            </>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

function Section({ children, description, flex, title }: { children: React.ReactNode; description?: string; flex?: boolean; title: string }) {
  return (
    <YStack bg="$surface" borderColor="$border" borderWidth={1} flex={flex ? 1 : undefined} gap="$md" p="$base" width={flex ? undefined : '100%'} style={{ borderRadius: 16, minWidth: 0 }}>
      <YStack gap="$xs">
        <Text color="$text" fontSize={17} fontWeight="600">{title}</Text>
        {description ? <Text color="$textSecondary" fontSize={13} lineHeight={19}>{description}</Text> : null}
      </YStack>
      {children}
    </YStack>
  );
}

function Field({ flex, label, onChange, placeholder, value }: { flex?: boolean; label: string; onChange: (value: string) => void; placeholder?: string; value: string }) {
  return (
    <YStack flex={flex ? 1 : undefined} gap="$xs">
      <Label color="$textSecondary" fontSize={12}>{label}</Label>
      <AppInput aria-label={label} placeholder={placeholder} value={value} onChangeText={onChange} />
    </YStack>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return <XStack gap="$sm"><Text color="$textMuted" fontSize={12}>{label}</Text><Text color="$text" flex={1} fontSize={13}>{value}</Text></XStack>;
}

function SourceSnippet({ text }: { text: string }) {
  const { t } = useTranslation('gmail');
  return <Text color="$textMuted" fontSize={12}>{t('confirm.source', { text })}</Text>;
}

function ChoiceButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <AppButton variant={active ? 'primary' : 'secondary'} onPress={onPress}>{label}</AppButton>;
}

function ModeButtons({ firstActive, firstLabel, onFirst, onSecond, secondActive, secondLabel }: { firstActive: boolean; firstLabel: string; onFirst: () => void; onSecond: () => void; secondActive?: boolean; secondLabel: string }) {
  return <XStack flexWrap="wrap" gap="$sm"><ChoiceButton active={firstActive} label={firstLabel} onPress={onFirst} /><ChoiceButton active={secondActive ?? !firstActive} label={secondLabel} onPress={onSecond} /></XStack>;
}

function ChoiceList<T extends string>({ empty, items, onSelect, selectedId }: { empty: string; items: { id: T; label: string }[]; onSelect: (id: T) => void; selectedId: T | null }) {
  if (items.length === 0) return <Text color="$textMuted" fontSize={13}>{empty}</Text>;
  return <XStack flexWrap="wrap" gap="$sm">{items.map((item) => <ChoiceButton key={item.id} active={selectedId === item.id} label={item.label} onPress={() => onSelect(item.id)} />)}</XStack>;
}

function CheckRow({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <XStack gap="$sm" style={{ alignItems: 'center' }}>
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)}><Checkbox.Indicator><CheckCircle2 size={16} /></Checkbox.Indicator></Checkbox>
      <Text color="$text" flex={1} fontSize={14} onPress={() => onChange(!checked)}>{label}</Text>
    </XStack>
  );
}

function StepTypeChoices({ onChange, value }: { onChange: (value: StepType) => void; value: StepType }) {
  const { t } = useTranslation('selection');
  return <XStack flexWrap="wrap" gap="$sm">{stepTypes.map((type) => <ChoiceButton key={type} active={value === type} label={t(`stepType.${type}`)} onPress={() => onChange(type)} />)}</XStack>;
}

function TimingChoices({ onChange, value }: { onChange: (value: TimingType) => void; value: TimingType }) {
  const { t } = useTranslation('gmail');
  return <XStack gap="$sm"><ChoiceButton active={value === 'scheduled'} label={t('confirm.scheduled')} onPress={() => onChange('scheduled')} /><ChoiceButton active={value === 'deadline'} label={t('confirm.deadline')} onPress={() => onChange('deadline')} /></XStack>;
}

function CenteredState({ action, detail, error, icon, text }: { action?: React.ReactNode; detail?: string; error?: boolean; icon?: React.ReactNode; text: string }) {
  return (
    <YStack bg="$background" flex={1} p="$base" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <YStack bg="$surface" borderColor="$border" borderWidth={1} gap="$md" maxW={520} p="$xl" width="100%" style={{ alignItems: 'center', borderRadius: 18 }}>
        {icon ?? (!error ? <Spinner color="$accentStrong" size="large" /> : <Mail color="$danger" size={34} />)}
        <Text color={error ? '$danger' : '$text'} fontSize={16} fontWeight="600" style={{ textAlign: 'center' }}>{text}</Text>
        {detail ? <Text color="$textSecondary" fontSize={13} style={{ textAlign: 'center' }}>{detail}</Text> : null}
        {action}
      </YStack>
    </YStack>
  );
}
