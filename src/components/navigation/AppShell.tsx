import {
  BookOpen,
  Building2,
  CalendarDays,
  Home,
  User as UserIcon,
} from '@tamagui/lucide-icons-2';
import { Href, Link, usePathname } from 'expo-router';
import { ReactNode } from 'react';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { XStack, YStack, Text, useMedia } from 'tamagui';

const sidebarWidth = 216;

type NavigationItem = {
  href: Href;
  labelKey: string;
  match: (pathname: string) => boolean;
  icon: typeof Home;
};

const navigationItems: NavigationItem[] = [
  { href: '/', labelKey: 'home', match: (path) => path === '/', icon: Home },
  {
    href: '/companies',
    labelKey: 'companies',
    match: (path) => path === '/companies' || path.startsWith('/applications'),
    icon: Building2,
  },
  { href: '/calendar', labelKey: 'calendar', match: (path) => path === '/calendar', icon: CalendarDays },
  { href: '/knowledge', labelKey: 'knowledge', match: (path) => path.startsWith('/knowledge'), icon: BookOpen },
  { href: '/profile', labelKey: 'profile', match: (path) => path === '/profile', icon: UserIcon },
];

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const media = useMedia();
  const isDesktop = Boolean(media.md);

  return (
    <YStack flex={1} bg="$background" style={{ minHeight: '100%' }}>
      {isDesktop ? <DesktopSidebar /> : null}
      <YStack
        flex={1}
        pb={isDesktop ? 0 : 76}
        style={{ marginLeft: isDesktop ? sidebarWidth : 0, minHeight: '100%' }}
      >
        {children}
      </YStack>
      {isDesktop ? null : <MobileBottomNav />}
    </YStack>
  );
}

function DesktopSidebar() {
  const { t } = useTranslation('common');
  const pathname = usePathname();

  return (
    <YStack
      width={sidebarWidth}
      bg="$background"
      borderRightWidth={1}
      borderRightColor="$border"
      p="$base"
      gap="$lg"
      style={{
        bottom: 0,
        left: 0,
        position: 'fixed',
        top: 0,
      }}
    >
      <YStack gap="$xs" px="$sm" pt="$sm">
        <Text color="$text" fontSize={18} fontWeight="600">
          {t('brand.title')}
        </Text>
        <Text color="$textMuted" fontSize={12}>
          {t('brand.subtitle')}
        </Text>
      </YStack>
      <YStack gap="$xs">
        {navigationItems.map((item) => (
          <NavLink key={item.labelKey} item={item} active={item.match(pathname)} desktop t={t} />
        ))}
      </YStack>
    </YStack>
  );
}

function MobileBottomNav() {
  const { t } = useTranslation('common');
  const pathname = usePathname();

  return (
    <XStack
      minH={64}
      bg="$surface"
      borderTopWidth={1}
      borderTopColor="$border"
      px="$xs"
      pb="$xs"
      pt="$xs"
      style={{
        bottom: 0,
        justifyContent: 'space-around',
        left: 0,
        position: 'fixed',
        right: 0,
      }}
    >
      {navigationItems.map((item) => (
        <NavLink key={item.labelKey} item={item} active={item.match(pathname)} t={t} />
      ))}
    </XStack>
  );
}

function NavLink({
  active,
  desktop = false,
  item,
  t,
}: {
  active: boolean;
  desktop?: boolean;
  item: NavigationItem;
  t: TFunction;
}) {
  const Icon = item.icon;

  return (
    <Link href={item.href} asChild>
      <XStack
        gap="$sm"
        minH={desktop ? 44 : 52}
        px={desktop ? '$md' : '$xs'}
        bg={active ? '$accentSoft' : 'transparent'}
        cursor="pointer"
        style={{
          alignItems: 'center',
          borderRadius: 12,
          justifyContent: desktop ? 'flex-start' : 'center',
          minWidth: desktop ? undefined : 64,
        }}
        focusStyle={{
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
          outlineWidth: 2,
        }}
      >
        <Icon size={20} color={active ? '$accentStrong' : '$textSecondary'} />
        <Text
          color={active ? '$accentStrong' : '$textSecondary'}
          fontSize={desktop ? 15 : 11}
          fontWeight={active ? '600' : '500'}
        >
          {t(`navigation.${item.labelKey}`)}
        </Text>
      </XStack>
    </Link>
  );
}
