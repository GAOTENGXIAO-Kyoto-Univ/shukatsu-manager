import { useClerk, useUser } from '@clerk/expo';
import {
  ChevronRight,
  LogOut,
  Mail,
  Pencil,
  ShieldCheck,
  UserRound,
} from '@tamagui/lucide-icons-2';
import { useQuery_experimental as useQuery } from 'convex/react';
import { ReactNode, useEffect, useState } from 'react';
import { Image, ScrollView } from 'react-native';
import { Button, Text, XStack, YStack, useMedia } from 'tamagui';

import { api } from '../../../convex/_generated/api';
import { warmPaperColors } from '../../../tamagui.config';
import { DisplayNameEditor } from '@/components/profile/DisplayNameEditor';
import { AppButton } from '@/components/ui/AppButton';

export default function ProfileScreen() {
  const media = useMedia();
  const isDesktop = Boolean(media.md);
  const { isLoaded, isSignedIn, user } = useUser();
  const clerk = useClerk();
  const [editorOpen, setEditorOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const currentUserState = useQuery({
    query: api.users.current,
    args: { retryToken },
  });

  async function handleSignOut() {
    setLogoutError(null);
    setIsSigningOut(true);

    try {
      await clerk.signOut();
    } catch {
      setLogoutError('退出失败，请重试');
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
        我的
      </Text>
      <Text color="$textSecondary" fontSize={isDesktop ? 16 : 14} lineHeight={22}>
        管理个人资料与账号
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
      <ProfileSection title="个人信息">
        <InfoRow borderBottom label="头像">
          <ProfileAvatar imageUrl={user.imageUrl} />
        </InfoRow>
        <InfoRow borderBottom label="显示名称">
          <XStack flex={1} gap="$sm" style={{ alignItems: 'center', justifyContent: 'flex-end' }}>
            <Text
              color={currentUser.displayName ? '$text' : '$textMuted'}
              fontSize={15}
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              {currentUser.displayName ?? '未设置'}
            </Text>
            <AppButton
              aria-label="编辑显示名称"
              icon={<Pencil size={15} />}
              minH={36}
              px="$sm"
              variant="ghost"
              onPress={() => setEditorOpen(true)}
            >
              编辑
            </AppButton>
          </XStack>
        </InfoRow>
        <InfoRow label="登录邮箱">
          <XStack flex={1} gap="$sm" style={{ alignItems: 'center', justifyContent: 'flex-end' }}>
            <Mail color="$textMuted" size={17} />
            <Text
              color={email ? '$textSecondary' : '$textMuted'}
              fontSize={15}
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              {email ?? '未设置'}
            </Text>
          </XStack>
        </InfoRow>
      </ProfileSection>

      <ProfileSection title="账号">
        <ActionRow
          icon={<ShieldCheck color="$accentStrong" size={20} />}
          label="账号管理"
          onPress={() => clerk.openUserProfile()}
        />
      </ProfileSection>

      <YStack gap="$sm" pt="$sm">
        <Button
          unstyled
          aria-label="退出登录"
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
              {isSigningOut ? '正在退出...' : '退出登录'}
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

function ActionRow({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Button
      unstyled
      aria-label={label}
      cursor="pointer"
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
      onPress={onPress}
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
        <ChevronRight color="$textMuted" size={18} />
      </XStack>
    </Button>
  );
}

function ProfileAvatar({ imageUrl }: { imageUrl?: string }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

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
      accessibilityLabel="当前账号头像"
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
        加载失败，请重试
      </Text>
      <AppButton onPress={onRetry}>重试</AppButton>
    </YStack>
  );
}

function ProfileUnavailable() {
  return (
    <YStack
      bg="$surface"
      borderColor="$border"
      borderWidth={1}
      p="$xl"
      style={{ alignItems: 'center', borderRadius: 16 }}
    >
      <Text color="$textSecondary" fontSize={15} style={{ textAlign: 'center' }}>
        账号信息暂不可用，请稍后重试
      </Text>
    </YStack>
  );
}
