import { useClerk, useUser } from '@clerk/expo';
import {
  ChevronRight,
  Download,
  LogOut,
  Languages,
  Mail,
  Pencil,
  ShieldCheck,
  Upload,
  UserRound,
} from '@tamagui/lucide-icons-2';
import { useConvex, useQuery_experimental as useQuery } from 'convex/react';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Image, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text, XStack, YStack, useMedia } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import { warmPaperColors } from '../../../tamagui.config';
import { DisplayNameEditor } from '@/components/profile/DisplayNameEditor';
import {
  BackupRestoreOverlay,
  type BackupRestorePreview,
} from '@/components/profile/BackupRestoreOverlay';
import { LanguageSelectorOverlay } from '@/components/profile/LanguageSelectorOverlay';
import { AppButton } from '@/components/ui/AppButton';
import { AppToast } from '@/components/ui/AppToast';
import { getCurrentAppLocale, LOCALE_DISPLAY_NAMES } from '@/i18n';
import {
  downloadBackupJson,
  getBackupErrorCode,
  pickBackupJsonFile,
  readAndPreflightBackupFile,
  type BackupClientErrorCode,
} from '@/lib/backup';

export default function ProfileScreen() {
  const { t } = useTranslation(['profile', 'common']);
  const media = useMedia();
  const isDesktop = Boolean(media.md);
  const { isLoaded, isSignedIn, user } = useUser();
  const clerk = useClerk();
  const convex = useConvex();
  const [editorOpen, setEditorOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreSessionKey, setRestoreSessionKey] = useState(0);
  const [backupJson, setBackupJson] = useState<string | null>(null);
  const [backupPreview, setBackupPreview] = useState<BackupRestorePreview | null>(null);
  const [backupValidationError, setBackupValidationError] =
    useState<BackupClientErrorCode | null>(null);
  const [isValidatingBackup, setIsValidatingBackup] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const restoreRequestIdRef = useRef(0);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const currentUserState = useQuery({
    query: api.users.current,
    args: { retryToken },
  });

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const handle = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(handle);
  }, [toastMessage]);

  async function exportBackup() {
    if (isExportingBackup) {
      return false;
    }

    setIsExportingBackup(true);

    try {
      const backup = await convex.query(api.backups.exportBackup, {});
      downloadBackupJson(backup, backup.exportedAt);
      setToastMessage(t('profile:backup.exportSuccess'));
      return true;
    } catch (error) {
      setToastMessage(
        getBackupErrorCode(error) === 'too_large'
          ? t('profile:backup.errors.too_large')
          : t('profile:backup.exportFailed'),
      );
      return false;
    } finally {
      setIsExportingBackup(false);
    }
  }

  async function chooseBackupForRestore() {
    const file = await pickBackupJsonFile();

    if (!file) {
      return;
    }

    const requestId = restoreRequestIdRef.current + 1;
    restoreRequestIdRef.current = requestId;
    setRestoreSessionKey((value) => value + 1);
    setRestoreOpen(true);
    setBackupJson(null);
    setBackupPreview(null);
    setBackupValidationError(null);
    setIsValidatingBackup(true);

    try {
      const selectedBackupJson = await readAndPreflightBackupFile(file);
      const preview = await convex.query(api.backups.previewRestore, {
        backupJson: selectedBackupJson,
      });

      if (restoreRequestIdRef.current !== requestId) {
        return;
      }

      setBackupJson(selectedBackupJson);
      setBackupPreview(preview);
    } catch (error) {
      if (restoreRequestIdRef.current !== requestId) {
        return;
      }

      setBackupValidationError(getBackupErrorCode(error) ?? 'unknown');
    } finally {
      if (restoreRequestIdRef.current === requestId) {
        setIsValidatingBackup(false);
      }
    }
  }

  function closeRestore() {
    restoreRequestIdRef.current += 1;
    setRestoreOpen(false);
    setBackupJson(null);
    setBackupPreview(null);
    setBackupValidationError(null);
    setIsValidatingBackup(false);
  }

  async function handleSignOut() {
    setLogoutError(null);
    setIsSigningOut(true);

    try {
      await clerk.signOut();
    } catch {
      setLogoutError(t('profile:signOutFailed'));
      setIsSigningOut(false);
    }
  }

  const pageHeader = (
    <YStack gap="$xs" py={isDesktop ? '$md' : '$sm'}>
      <Text
        color="$text"
        fontSize={isDesktop ? 34 : 28}
        fontWeight="600"
        lineHeight={isDesktop ? 43 : 36}
      >
        {t('profile:title')}
      </Text>
      <Text color="$textSecondary" fontSize={isDesktop ? 16 : 14} lineHeight={22}>
        {t('profile:description')}
      </Text>
    </YStack>
  );

  if (!isLoaded || currentUserState.status === 'pending') {
    return (
      <ProfilePageFrame header={pageHeader} isDesktop={isDesktop}>
        <ProfileSkeleton />
      </ProfilePageFrame>
    );
  }

  if (currentUserState.status === 'error' || currentUserState.data === null) {
    return (
      <ProfilePageFrame header={pageHeader} isDesktop={isDesktop}>
        <ProfileError onRetry={() => setRetryToken((value) => value + 1)} />
      </ProfilePageFrame>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <ProfilePageFrame header={pageHeader} isDesktop={isDesktop}>
        <ProfileUnavailable />
      </ProfilePageFrame>
    );
  }

  const currentUser = currentUserState.data;
  const email = user.primaryEmailAddress?.emailAddress;

  return (
    <ProfilePageFrame header={pageHeader} isDesktop={isDesktop}>
      <ProfileSection title={t('profile:personalInfo')}>
        <InfoRow borderBottom label={t('profile:avatar')}>
          <ProfileAvatar
            key={user.imageUrl}
            accessibilityLabel={t('profile:currentAvatar')}
            imageUrl={user.imageUrl}
          />
        </InfoRow>
        <InfoRow borderBottom label={t('profile:displayName')}>
          <XStack flex={1} gap="$sm" style={{ alignItems: 'center', justifyContent: 'flex-end' }}>
            <Text
              color={currentUser.displayName ? '$text' : '$textMuted'}
              fontSize={15}
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              {currentUser.displayName ?? t('common:states.notSet')}
            </Text>
            <AppButton
              aria-label={t('profile:editDisplayName')}
              icon={<Pencil size={15} />}
              minH={36}
              px="$sm"
              variant="ghost"
              onPress={() => setEditorOpen(true)}
            >
              {t('common:actions.edit')}
            </AppButton>
          </XStack>
        </InfoRow>
        <InfoRow label={t('profile:loginEmail')}>
          <XStack flex={1} gap="$sm" style={{ alignItems: 'center', justifyContent: 'flex-end' }}>
            <Mail color="$textMuted" size={17} />
            <Text
              color={email ? '$textSecondary' : '$textMuted'}
              fontSize={15}
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              {email ?? t('common:states.notSet')}
            </Text>
          </XStack>
        </InfoRow>
      </ProfileSection>

      <ProfileSection title={t('profile:backup.dataManagement')}>
        <ActionRow
          borderBottom
          disabled={isExportingBackup}
          icon={<Download color="$accentStrong" size={20} />}
          label={t('profile:backup.export')}
          value={isExportingBackup ? t('profile:backup.exporting') : undefined}
          onPress={() => void exportBackup()}
        />
        <ActionRow
          icon={<Upload color="$accentStrong" size={20} />}
          label={t('profile:backup.restore')}
          onPress={() => void chooseBackupForRestore()}
        />
      </ProfileSection>

      <ProfileSection title={t('profile:appSettings')}>
        <ActionRow
          icon={<Languages color="$accentStrong" size={20} />}
          label={t('profile:language')}
          value={LOCALE_DISPLAY_NAMES[getCurrentAppLocale()]}
          onPress={() => setLanguageOpen(true)}
        />
      </ProfileSection>

      <ProfileSection title={t('profile:account')}>
        <ActionRow
          icon={<ShieldCheck color="$accentStrong" size={20} />}
          label={t('profile:accountManagement')}
          onPress={() => clerk.openUserProfile()}
        />
      </ProfileSection>

      <YStack gap="$sm" pt="$sm">
        <Button
          unstyled
          aria-label={t('profile:signOut')}
          borderColor="$border"
          borderWidth={1}
          cursor={isSigningOut ? 'not-allowed' : 'pointer'}
          disabled={isSigningOut}
          minH={52}
          px="$base"
          pressStyle={{ opacity: 0.72 }}
          hoverStyle={{ background: warmPaperColors.dangerSoft }}
          focusStyle={{
            outlineColor: warmPaperColors.focusRing,
            outlineStyle: 'solid',
            outlineWidth: 2,
          }}
          style={{ borderRadius: 13, justifyContent: 'center' }}
          onPress={handleSignOut}
        >
          <XStack gap="$sm" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <LogOut color="$danger" size={19} />
            <Text color="$danger" fontSize={15} fontWeight="600">
              {isSigningOut ? t('profile:signingOut') : t('profile:signOut')}
            </Text>
          </XStack>
        </Button>
        {logoutError ? (
          <Text color="$danger" fontSize={13} style={{ textAlign: 'center' }}>
            {logoutError}
          </Text>
        ) : null}
      </YStack>

      <DisplayNameEditor
        currentDisplayName={currentUser.displayName}
        onClose={() => setEditorOpen(false)}
        open={editorOpen}
      />
      {languageOpen ? (
        <LanguageSelectorOverlay onClose={() => setLanguageOpen(false)} open />
      ) : null}
      <BackupRestoreOverlay
        key={restoreSessionKey}
        backupJson={backupJson}
        onClose={closeRestore}
        onExportCurrent={exportBackup}
        onRestoreSuccess={() => setToastMessage(t('profile:backup.restoreSuccess'))}
        open={restoreOpen}
        preview={backupPreview}
        timezone={currentUser.timezone}
        validationError={backupValidationError}
        validating={isValidatingBackup}
      />
      <AppToast message={toastMessage} />
    </ProfilePageFrame>
  );
}

function ProfilePageFrame({
  children,
  header,
  isDesktop,
}: {
  children: ReactNode;
  header: ReactNode;
  isDesktop: boolean;
}) {
  return (
    <YStack bg="$background" flex={1}>
      <ScrollView style={{ flex: 1 }}>
        <YStack
          gap="$lg"
          maxW={760}
          p={isDesktop ? '$xl' : '$base'}
          pb="$xxl"
          width="100%"
        >
          {header}
          {children}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

function ProfileSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <YStack gap="$sm">
      <Text color="$textSecondary" fontSize={14} fontWeight="600" px="$xs">
        {title}
      </Text>
      <YStack
        bg="$surface"
        borderColor="$border"
        borderWidth={1}
        style={{ borderRadius: 16, overflow: 'hidden' }}
      >
        {children}
      </YStack>
    </YStack>
  );
}

function InfoRow({
  borderBottom = false,
  children,
  label,
}: {
  borderBottom?: boolean;
  children: ReactNode;
  label: string;
}) {
  return (
    <XStack
      borderBottomColor="$border"
      borderBottomWidth={borderBottom ? 1 : 0}
      gap="$base"
      minH={68}
      px="$base"
      py="$md"
      style={{ alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Text color="$text" fontSize={15} fontWeight="600">
        {label}
      </Text>
      {children}
    </XStack>
  );
}

function ActionRow({
  borderBottom = false,
  disabled = false,
  icon,
  label,
  onPress,
  value,
}: {
  borderBottom?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
  value?: string;
}) {
  return (
    <Button
      unstyled
      aria-label={label}
      borderBottomColor="$border"
      borderBottomWidth={borderBottom ? 1 : 0}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      disabled={disabled}
      minH={64}
      px="$base"
      pressStyle={{ opacity: 0.72 }}
      hoverStyle={{ background: warmPaperColors.surfaceMuted }}
      focusStyle={{
        outlineColor: warmPaperColors.focusRing,
        outlineStyle: 'solid',
        outlineWidth: 2,
      }}
      style={{ justifyContent: 'center' }}
      onPress={disabled ? undefined : onPress}
    >
      <XStack width="100%" gap="$md" style={{ alignItems: 'center' }}>
        <YStack
          bg="$accentSoft"
          height={38}
          width={38}
          style={{ alignItems: 'center', borderRadius: 9999, justifyContent: 'center' }}
        >
          {icon}
        </YStack>
        <Text color="$text" flex={1} fontSize={15} fontWeight="600">
          {label}
        </Text>
        {value ? <Text color="$textSecondary" fontSize={14}>{value}</Text> : null}
        <ChevronRight color="$textMuted" size={18} />
      </XStack>
    </Button>
  );
}

function ProfileAvatar({
  accessibilityLabel,
  imageUrl,
}: {
  accessibilityLabel: string;
  imageUrl?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!imageUrl || imageFailed) {
    return (
      <YStack
        bg="$surfaceMuted"
        height={52}
        width={52}
        style={{ alignItems: 'center', borderRadius: 9999, justifyContent: 'center' }}
      >
        <UserRound color="$textSecondary" size={24} />
      </YStack>
    );
  }

  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      onError={() => setImageFailed(true)}
      source={{ uri: imageUrl }}
      style={{ borderRadius: 9999, height: 52, width: 52 }}
    />
  );
}

function ProfileSkeleton() {
  return (
    <YStack gap="$lg">
      <YStack gap="$sm">
        <SkeletonBlock height={16} width={72} />
        <YStack
          bg="$surface"
          borderColor="$border"
          borderWidth={1}
          gap="$md"
          p="$base"
          style={{ borderRadius: 16 }}
        >
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </YStack>
      </YStack>
      <YStack gap="$sm">
        <SkeletonBlock height={16} width={44} />
        <SkeletonBlock height={128} width="100%" radius={16} />
      </YStack>
      <YStack gap="$sm">
        <SkeletonBlock height={16} width={44} />
        <SkeletonBlock height={64} width="100%" radius={16} />
      </YStack>
    </YStack>
  );
}

function SkeletonRow() {
  return (
    <XStack minH={44} style={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <SkeletonBlock height={15} width={72} />
      <SkeletonBlock height={18} width="42%" />
    </XStack>
  );
}

function SkeletonBlock({
  height,
  radius = 8,
  width,
}: {
  height: number;
  radius?: number;
  width: number | `${number}%`;
}) {
  return <YStack bg="$surfaceMuted" height={height} width={width} style={{ borderRadius: radius }} />;
}

function ProfileError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('common');
  return (
    <YStack
      bg="$surface"
      borderColor="$border"
      borderWidth={1}
      gap="$md"
      p="$xl"
      style={{ alignItems: 'center', borderRadius: 16 }}
    >
      <Text color="$danger" fontSize={15}>
        {t('errors.load')}
      </Text>
      <AppButton onPress={onRetry}>{t('actions.retry')}</AppButton>
    </YStack>
  );
}

function ProfileUnavailable() {
  const { t } = useTranslation('profile');
  return (
    <YStack
      bg="$surface"
      borderColor="$border"
      borderWidth={1}
      p="$xl"
      style={{ alignItems: 'center', borderRadius: 16 }}
    >
      <Text color="$textSecondary" fontSize={15} style={{ textAlign: 'center' }}>
        {t('accountUnavailable')}
      </Text>
    </YStack>
  );
}
