import { AlertTriangle, CheckCircle2 } from '@tamagui/lucide-icons-2';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import { ResponsiveOverlay } from '@/components/companies/ResponsiveOverlay';
import { AppButton } from '@/components/ui/AppButton';
import { getCurrentAppLocale } from '@/i18n';
import {
  formatBackupTimestamp,
  type BackupClientErrorCode,
} from '@/lib/backup';

export type BackupRestorePreview = {
  exportedAt: number;
  isCurrentAccountEmpty: boolean;
  counts: {
    companies: number;
    applications: number;
    selectionSteps: number;
    events: number;
    interviewDetails: number;
    interviewQuestions: number;
    knowledgeItems: number;
    researchItems: number;
  };
};

type RestoreStage =
  | 'preview'
  | 'overwriteWarning'
  | 'exportPrompt'
  | 'restoring'
  | 'success'
  | 'failure';

type BackupRestoreOverlayProps = {
  backupJson: string | null;
  onClose: () => void;
  onExportCurrent: () => Promise<boolean>;
  onRestoreSuccess: () => void;
  open: boolean;
  preview: BackupRestorePreview | null;
  timezone?: string;
  validationError: BackupClientErrorCode | null;
  validating: boolean;
};

export function BackupRestoreOverlay({
  backupJson,
  onClose,
  onExportCurrent,
  onRestoreSuccess,
  open,
  preview,
  timezone,
  validationError,
  validating,
}: BackupRestoreOverlayProps) {
  const { t } = useTranslation(['profile', 'common']);
  const restoreBackup = useMutation(api.backups.restoreBackup);
  const [stage, setStage] = useState<RestoreStage>('preview');
  const [exportFailed, setExportFailed] = useState(false);
  const isRestoring = stage === 'restoring';

  function requestClose() {
    if (!isRestoring) {
      onClose();
    }
  }

  async function restore() {
    if (!backupJson || isRestoring) {
      return;
    }

    setStage('restoring');

    try {
      await restoreBackup({ backupJson });
      setStage('success');
      onRestoreSuccess();
    } catch {
      setStage('failure');
    }
  }

  async function exportBeforeOverwrite() {
    setExportFailed(false);
    const exported = await onExportCurrent();

    if (exported) {
      onClose();
    } else {
      setExportFailed(true);
    }
  }

  return (
    <ResponsiveOverlay
      dismissOnEscape={!isRestoring}
      mobileNearFullscreen
      onClose={requestClose}
      open={open}
      title={t('profile:backup.restoreTitle')}
      width={620}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 4 }} style={{ flex: 1 }}>
        {validating ? (
          <YStack gap="$md" py="$xl" style={{ alignItems: 'center' }}>
            <Text color="$text" fontSize={17} fontWeight="600">
              {t('profile:backup.validating')}
            </Text>
            <Text color="$textSecondary" style={{ textAlign: 'center' }}>
              {t('profile:backup.validatingDescription')}
            </Text>
          </YStack>
        ) : validationError ? (
          <YStack gap="$lg">
            <Text color="$danger" fontSize={15} lineHeight={22}>
              {t(`profile:backup.errors.${validationError}`)}
            </Text>
            <XStack style={{ justifyContent: 'flex-end' }}>
              <AppButton onPress={requestClose} variant="secondary">
                {t('common:actions.close')}
              </AppButton>
            </XStack>
          </YStack>
        ) : preview ? (
          <RestoreContent
            exportFailed={exportFailed}
            onCancel={requestClose}
            onConfirmOverwrite={() => setStage('exportPrompt')}
            onExportCurrent={() => void exportBeforeOverwrite()}
            onRestore={() => void restore()}
            onReturnToPreview={() => setStage('preview')}
            onStartOverwrite={() => setStage('overwriteWarning')}
            preview={preview}
            stage={stage}
            timezone={timezone}
          />
        ) : (
          <Text color="$danger">{t('profile:backup.errors.incomplete')}</Text>
        )}
      </ScrollView>
    </ResponsiveOverlay>
  );
}

function RestoreContent({
  exportFailed,
  onCancel,
  onConfirmOverwrite,
  onExportCurrent,
  onRestore,
  onReturnToPreview,
  onStartOverwrite,
  preview,
  stage,
  timezone,
}: {
  exportFailed: boolean;
  onCancel: () => void;
  onConfirmOverwrite: () => void;
  onExportCurrent: () => void;
  onRestore: () => void;
  onReturnToPreview: () => void;
  onStartOverwrite: () => void;
  preview: BackupRestorePreview;
  stage: RestoreStage;
  timezone?: string;
}) {
  const { t } = useTranslation(['profile', 'common']);

  if (stage === 'overwriteWarning') {
    return (
      <YStack gap="$lg">
        <WarningHeader title={t('profile:backup.overwriteWarningTitle')} />
        <Text color="$textSecondary" lineHeight={23}>
          {t('profile:backup.overwriteWarningDescription')}
        </Text>
        <XStack flexWrap="wrap" gap="$sm" style={{ justifyContent: 'flex-end' }}>
          <AppButton onPress={onReturnToPreview} variant="secondary">
            {t('common:actions.cancel')}
          </AppButton>
          <AppButton onPress={onConfirmOverwrite} variant="danger">
            {t('common:actions.confirm')}
          </AppButton>
        </XStack>
      </YStack>
    );
  }

  if (stage === 'exportPrompt') {
    return (
      <YStack gap="$lg">
        <WarningHeader title={t('profile:backup.exportPromptTitle')} />
        <Text color="$textSecondary" lineHeight={23}>
          {t('profile:backup.exportPromptDescription')}
        </Text>
        {exportFailed ? (
          <Text color="$danger">{t('profile:backup.exportFailed')}</Text>
        ) : null}
        <YStack gap="$sm">
          <AppButton onPress={onExportCurrent} variant="primary">
            {t('profile:backup.exportCurrentFirst')}
          </AppButton>
          <AppButton onPress={onRestore} variant="danger">
            {t('profile:backup.overwriteDirectly')}
          </AppButton>
          <AppButton onPress={onReturnToPreview} variant="ghost">
            {t('common:actions.cancel')}
          </AppButton>
        </YStack>
      </YStack>
    );
  }

  if (stage === 'restoring') {
    return (
      <YStack gap="$md" py="$xl" style={{ alignItems: 'center' }}>
        <Text color="$text" fontSize={18} fontWeight="600">
          {t('profile:backup.restoring')}
        </Text>
        <Text color="$textSecondary" lineHeight={22} style={{ textAlign: 'center' }}>
          {t('profile:backup.restoringDescription')}
        </Text>
      </YStack>
    );
  }

  if (stage === 'success') {
    return (
      <YStack gap="$lg" py="$lg" style={{ alignItems: 'center' }}>
        <CheckCircle2 color="$accentStrong" size={34} />
        <Text color="$text" fontSize={18} fontWeight="600">
          {t('profile:backup.restoreSuccess')}
        </Text>
        <AppButton onPress={onCancel} variant="primary">
          {t('common:actions.close')}
        </AppButton>
      </YStack>
    );
  }

  if (stage === 'failure') {
    return (
      <YStack gap="$lg">
        <WarningHeader title={t('profile:backup.restoreFailed')} />
        <Text color="$textSecondary" lineHeight={23}>
          {t('profile:backup.restoreFailedUnchanged')}
        </Text>
        <XStack flexWrap="wrap" gap="$sm" style={{ justifyContent: 'flex-end' }}>
          <AppButton onPress={onCancel} variant="secondary">
            {t('common:actions.close')}
          </AppButton>
          <AppButton onPress={onReturnToPreview} variant="primary">
            {t('common:actions.retry')}
          </AppButton>
        </XStack>
      </YStack>
    );
  }

  const previewRows = [
    ['companies', preview.counts.companies],
    ['applications', preview.counts.applications],
    ['selectionSteps', preview.counts.selectionSteps],
    ['events', preview.counts.events],
    ['interviewDetails', preview.counts.interviewDetails],
    ['interviewQuestions', preview.counts.interviewQuestions],
    ['knowledgeItems', preview.counts.knowledgeItems],
    ['researchItems', preview.counts.researchItems],
  ] as const;

  return (
    <YStack gap="$lg">
      <YStack gap="$xs">
        <Text color="$text" fontSize={18} fontWeight="600">
          {t('profile:backup.previewTitle')}
        </Text>
        <Text color="$textSecondary" lineHeight={22}>
          {t('profile:backup.backupTime', {
            value: formatBackupTimestamp(
              preview.exportedAt,
              getCurrentAppLocale(),
              timezone,
            ),
          })}
        </Text>
      </YStack>
      <YStack borderColor="$border" borderWidth={1} style={{ borderRadius: 13, overflow: 'hidden' }}>
        {previewRows.map(([key, value], index) => (
          <XStack
            key={key}
            borderBottomColor="$border"
            borderBottomWidth={index === previewRows.length - 1 ? 0 : 1}
            px="$base"
            py="$sm"
            style={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text color="$textSecondary">{t(`profile:backup.counts.${key}`)}</Text>
            <Text color="$text" fontWeight="600">{value}</Text>
          </XStack>
        ))}
      </YStack>
      <XStack flexWrap="wrap" gap="$sm" style={{ justifyContent: 'flex-end' }}>
        <AppButton onPress={onCancel} variant="secondary">
          {t('common:actions.cancel')}
        </AppButton>
        <AppButton
          onPress={preview.isCurrentAccountEmpty ? onRestore : onStartOverwrite}
          variant={preview.isCurrentAccountEmpty ? 'primary' : 'danger'}
        >
          {t('profile:backup.restoreThisBackup')}
        </AppButton>
      </XStack>
    </YStack>
  );
}

function WarningHeader({ title }: { title: string }) {
  return (
    <XStack gap="$sm" style={{ alignItems: 'center' }}>
      <AlertTriangle color="$danger" size={24} />
      <Text color="$text" fontSize={18} fontWeight="600">{title}</Text>
    </XStack>
  );
}
