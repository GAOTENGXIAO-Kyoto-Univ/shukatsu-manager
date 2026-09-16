import { useMutation, useQuery_experimental as useQuery } from 'convex/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { normalizeSearch } from '@/components/companies/filtering';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import {
  getSelectionStepDisplayName,
  getStepTypeLabel,
  type SelectionStepPresetKey,
  type SelectionStepType,
} from './selectionConstants';
import { SelectionProcessPreview } from './SelectionProcessPreview';

type CopySelectionProcessOverlayProps = {
  applicationId: Id<'applications'>;
  onClose: () => void;
  open: boolean;
};

export function CopySelectionProcessOverlay({
  applicationId,
  onClose,
  open,
}: CopySelectionProcessOverlayProps) {
  const { t } = useTranslation(['selection', 'common']);
  const sourceOptionsState = useQuery({
    query: api.selectionProcesses.listCopySources,
    args: open ? { targetApplicationId: applicationId } : 'skip',
  });
  const [companyQuery, setCompanyQuery] = useState('');
  const [applicationQuery, setApplicationQuery] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<Id<'companies'> | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<Id<'applications'> | null>(null);
  const sourcePreviewState = useQuery({
    query: api.selectionProcesses.getCopyPreview,
    args: open && selectedApplicationId ? { sourceApplicationId: selectedApplicationId } : 'skip',
  });
  const sourceCompanies = sourceOptionsState.status === 'success' ? sourceOptionsState.data : [];
  const selectedCompany = selectedCompanyId
    ? sourceCompanies.find((company) => company.companyId === selectedCompanyId) ?? null
    : null;
  const selectedApplication = selectedCompany && selectedApplicationId
    ? selectedCompany.applications.find(
        (application) => application.applicationId === selectedApplicationId,
      ) ?? null
    : null;
  const normalizedCompanyQuery = normalizeSearch(companyQuery);
  const companyMatches = sourceCompanies.filter((company) =>
    !normalizedCompanyQuery || normalizeSearch(company.name).includes(normalizedCompanyQuery),
  );
  const normalizedApplicationQuery = normalizeSearch(applicationQuery);
  const applicationMatches = (selectedCompany?.applications ?? []).filter((application) =>
    !normalizedApplicationQuery ||
    normalizeSearch(application.jobTitle).includes(normalizedApplicationQuery),
  );

  function clearApplicationSelection() {
    setApplicationQuery('');
    setSelectedApplicationId(null);
  }

  function selectCompany(companyId: Id<'companies'>, name: string) {
    setCompanyQuery(name);
    setSelectedCompanyId(companyId);
    clearApplicationSelection();
  }

  function selectApplication(applicationId: Id<'applications'>, jobTitle: string) {
    setApplicationQuery(jobTitle);
    setSelectedApplicationId(applicationId);
  }

  function close() {
    setCompanyQuery('');
    setApplicationQuery('');
    setSelectedCompanyId(null);
    setSelectedApplicationId(null);
    onClose();
  }

  return (
    <ResponsiveOverlay
      mobileNearFullscreen
      onClose={close}
      open={open}
      title={t('selection:copy.overlayTitle')}
      width={680}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 4 }}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        <YStack gap="$base">
          <Text color="$textSecondary" lineHeight={21}>
            {t('selection:copy.chooseDescription')}
          </Text>

          <YStack gap="$sm">
            <Text color="$text" fontWeight="600">
              {t('selection:copy.company')} *
            </Text>
            <AppInput
              placeholder={t('selection:copy.companyPlaceholder')}
              value={companyQuery}
              onChangeText={(value) => {
                setCompanyQuery(value);
                if (selectedCompany && value !== selectedCompany.name) {
                  setSelectedCompanyId(null);
                  clearApplicationSelection();
                }
              }}
            />
            {sourceOptionsState.status === 'pending' ? (
              <Text color="$textMuted">{t('selection:states.loadingCopySources')}</Text>
            ) : sourceOptionsState.status === 'error' ? (
              <Text color="$danger">{t('selection:messages.copySourcesLoadFailed')}</Text>
            ) : !selectedCompanyId && companyMatches.length > 0 ? (
              <YStack gap="$xs">
                {companyMatches.slice(0, 8).map((company) => (
                  <XStack
                    key={company.companyId}
                    bg="$surfaceMuted"
                    cursor="pointer"
                    onPress={() => selectCompany(company.companyId, company.name)}
                    p="$md"
                    style={{ borderRadius: 12 }}
                  >
                    <Text color="$text">{company.name}</Text>
                  </XStack>
                ))}
              </YStack>
            ) : sourceOptionsState.status === 'success' && sourceCompanies.length === 0 ? (
              <Text color="$textMuted">{t('selection:copy.noCompanies')}</Text>
            ) : !selectedCompanyId && normalizedCompanyQuery && companyMatches.length === 0 ? (
              <Text color="$textMuted">{t('selection:copy.noCompanyMatches')}</Text>
            ) : null}
          </YStack>

          <YStack gap="$sm">
            <Text color="$text" fontWeight="600">
              {t('selection:copy.application')} *
            </Text>
            <AppInput
              disabled={!selectedCompany}
              placeholder={t('selection:copy.applicationPlaceholder')}
              value={applicationQuery}
              onChangeText={(value) => {
                setApplicationQuery(value);
                if (selectedApplication && value !== selectedApplication.jobTitle) {
                  setSelectedApplicationId(null);
                }
              }}
            />
            {!selectedCompany ? (
              <Text color="$textMuted">{t('selection:copy.selectCompanyFirst')}</Text>
            ) : selectedCompany.applications.length === 0 ? (
              <Text color="$textMuted">{t('selection:copy.noEligibleProcesses')}</Text>
            ) : !selectedApplicationId && applicationMatches.length > 0 ? (
              <YStack gap="$xs">
                {applicationMatches.slice(0, 8).map((application) => (
                  <XStack
                    key={application.applicationId}
                    bg="$surfaceMuted"
                    cursor="pointer"
                    onPress={() => selectApplication(application.applicationId, application.jobTitle)}
                    p="$md"
                    style={{ alignItems: 'center', borderRadius: 12, justifyContent: 'space-between' }}
                  >
                    <Text color="$text" flex={1} numberOfLines={1}>{application.jobTitle}</Text>
                    <Text color="$textMuted" fontSize={12}>
                      {t('selection:copy.stepCount', { count: application.stepCount })}
                    </Text>
                  </XStack>
                ))}
              </YStack>
            ) : !selectedApplicationId && normalizedApplicationQuery && applicationMatches.length === 0 ? (
              <Text color="$textMuted">{t('selection:copy.noApplicationMatches')}</Text>
            ) : null}
          </YStack>

          {selectedApplicationId ? (
            <YStack borderTopColor="$border" borderTopWidth={1} gap="$base" pt="$base">
              <YStack gap="$xs">
                <Text color="$text" fontSize={18} fontWeight="600">
                  {t('selection:copy.previewTitle')}
                </Text>
                <Text color="$textSecondary" lineHeight={21}>
                  {t('selection:copy.structureOnlyExplanation')}
                </Text>
              </YStack>
              {sourcePreviewState.status === 'pending' ? (
                <Text color="$textMuted">{t('selection:states.loadingPreview')}</Text>
              ) : sourcePreviewState.status === 'error' ? (
                <Text color="$danger">{t('selection:messages.previewLoadFailed')}</Text>
              ) : sourcePreviewState.data === null || sourcePreviewState.data.length === 0 ? (
                <Text color="$warningStrong">{t('selection:copy.sourceUnavailable')}</Text>
              ) : (
                <CopyPreviewEditor
                  key={selectedApplicationId}
                  onClose={close}
                  sourceApplicationId={selectedApplicationId}
                  sourceSteps={sourcePreviewState.data}
                  targetApplicationId={applicationId}
                />
              )}
            </YStack>
          ) : null}

          {!(
            selectedApplicationId &&
            sourcePreviewState.status === 'success' &&
            sourcePreviewState.data &&
            sourcePreviewState.data.length > 0
          ) ? (
            <XStack style={{ justifyContent: 'flex-end' }}>
              <AppButton onPress={close} variant="secondary">
                {t('common:actions.cancel')}
              </AppButton>
            </XStack>
          ) : null}
        </YStack>
      </ScrollView>
    </ResponsiveOverlay>
  );
}

type CopyPreviewStep = {
  selectionStepId: Id<'selectionSteps'>;
  presetKey?: SelectionStepPresetKey;
  name: string;
  type: SelectionStepType;
  order: number;
};

function CopyPreviewEditor({
  onClose,
  sourceApplicationId,
  sourceSteps,
  targetApplicationId,
}: {
  onClose: () => void;
  sourceApplicationId: Id<'applications'>;
  sourceSteps: readonly CopyPreviewStep[];
  targetApplicationId: Id<'applications'>;
}) {
  const { t } = useTranslation(['selection', 'common']);
  const copyFromApplication = useMutation(api.selectionProcesses.copyFromApplication);
  const [expectedSourceStepIds] = useState(() =>
    sourceSteps.map((step) => step.selectionStepId),
  );
  const [orderedSourceStepIds, setOrderedSourceStepIds] = useState(() =>
    sourceSteps.map((step) => step.selectionStepId),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const currentSourceIds = sourceSteps.map((step) => step.selectionStepId);
  const sourceChanged =
    currentSourceIds.length !== expectedSourceStepIds.length ||
    currentSourceIds.some(
      (selectionStepId, index) => selectionStepId !== expectedSourceStepIds[index],
    );
  const previewStepById = new Map(
    sourceSteps.map((step) => [step.selectionStepId, step]),
  );
  const previewItems = orderedSourceStepIds.flatMap((selectionStepId) => {
    const step = previewStepById.get(selectionStepId);

    return step
      ? [{
          id: selectionStepId,
          label: getSelectionStepDisplayName(step, t),
          typeLabel: getStepTypeLabel(t, step.type),
        }]
      : [];
  });

  async function submit() {
    if (orderedSourceStepIds.length === 0 || sourceChanged || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await copyFromApplication({
        targetApplicationId,
        sourceApplicationId,
        expectedSourceStepIds,
        orderedSourceStepIds,
      });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';

      if (message.includes('SELECTION_PROCESS_TARGET_NOT_EMPTY')) {
        setErrorMessage(t('selection:messages.targetNoLongerEmpty'));
      } else if (
        message.includes('SELECTION_PROCESS_SOURCE_CHANGED') ||
        message.includes('SELECTION_PROCESS_UNAVAILABLE')
      ) {
        setErrorMessage(t('selection:messages.sourceChanged'));
      } else {
        setErrorMessage(t('selection:messages.copyFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <YStack gap="$base">
      {sourceChanged ? (
        <Text color="$warningStrong">{t('selection:messages.sourceChanged')}</Text>
      ) : previewItems.length > 0 ? (
        <SelectionProcessPreview
          items={previewItems}
          onChange={(orderedIds) => setOrderedSourceStepIds(orderedIds as Id<'selectionSteps'>[])}
        />
      ) : (
        <Text color="$warningStrong">{t('selection:messages.previewEmpty')}</Text>
      )}
      {errorMessage ? <Text color="$danger">{errorMessage}</Text> : null}
      <XStack flexWrap="wrap" gap="$sm" style={{ justifyContent: 'flex-end' }}>
        <AppButton disabled={isSubmitting} onPress={onClose} variant="secondary">
          {t('common:actions.cancel')}
        </AppButton>
        <AppButton
          disabled={isSubmitting || orderedSourceStepIds.length === 0 || sourceChanged}
          onPress={() => void submit()}
          variant="primary"
        >
          {isSubmitting ? t('selection:states.copyingProcess') : t('selection:actions.copyProcess')}
        </AppButton>
      </XStack>
    </YStack>
  );
}
