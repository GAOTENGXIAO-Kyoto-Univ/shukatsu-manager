import { ArrowRight } from '@tamagui/lucide-icons-2';
import { Href, Link } from 'expo-router';
import { Image, ScrollView, type ImageSourcePropType } from 'react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, XStack, YStack, useMedia } from 'tamagui';

import { AppButton } from '@/components/ui/AppButton';

const heroImage = require('../../../assets/section-imgs/dashboard.png') as ImageSourcePropType;

type Feature = {
  key: 'selection' | 'calendar' | 'interview' | 'knowledge';
  image: ImageSourcePropType;
};

const features: Feature[] = [
  {
    key: 'selection',
    image: require('../../../assets/section-imgs/selection-timeline.png') as ImageSourcePropType,
  },
  {
    key: 'calendar',
    image: require('../../../assets/section-imgs/calendar.png') as ImageSourcePropType,
  },
  {
    key: 'interview',
    image: require('../../../assets/section-imgs/interview.png') as ImageSourcePropType,
  },
  {
    key: 'knowledge',
    image: require('../../../assets/section-imgs/knowledge.png') as ImageSourcePropType,
  },
];

const steps = ['company', 'selection', 'review', 'knowledge'] as const;

const signInHref = '/sign-in' as Href;

const MAX_CONTENT_WIDTH = 1120;

export function LandingPage() {
  return (
    <YStack flex={1} bg="$background" style={{ minHeight: '100%' }}>
      <LandingHeader />
      <ScrollView style={{ flex: 1 }}>
        <YStack width="100%" style={{ alignItems: 'center' }}>
          <LandingContainer>
            <HeroSection />
            <FeatureGrid />
            <ProcessSection />
            <FinalCtaSection />
          </LandingContainer>
          <LandingFooter />
        </YStack>
      </ScrollView>
    </YStack>
  );
}

function LandingContainer({ children }: { children: ReactNode }) {
  const media = useMedia();
  const isDesktop = Boolean(media.md);

  return (
    <YStack
      gap={isDesktop ? 96 : 64}
      maxW={MAX_CONTENT_WIDTH}
      px={isDesktop ? '$xl' : '$base'}
      py={isDesktop ? 72 : 48}
      width="100%"
    >
      {children}
    </YStack>
  );
}

function LandingHeader() {
  const { t } = useTranslation('landing');
  const media = useMedia();
  const isDesktop = Boolean(media.md);

  return (
    <YStack
      bg="$background"
      borderBottomColor="$border"
      borderBottomWidth={1}
      style={{ alignItems: 'center' }}
    >
      <XStack
        maxW={MAX_CONTENT_WIDTH}
        px={isDesktop ? '$xl' : '$base'}
        py="$sm"
        width="100%"
        style={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Text color="$text" fontSize={isDesktop ? 16 : 15} fontWeight="600" letterSpacing={0.3}>
          shukatsu-manager
        </Text>
        <Link href={signInHref} asChild>
          <AppButton variant="secondary">{t('signIn')}</AppButton>
        </Link>
      </XStack>
    </YStack>
  );
}

function HeroSection() {
  const { t } = useTranslation('landing');
  const media = useMedia();
  const isDesktop = Boolean(media.md);

  return (
    <XStack
      gap={isDesktop ? '$xxl' : '$lg'}
      style={{ alignItems: 'center', flexDirection: isDesktop ? 'row' : 'column' }}
    >
      <YStack gap={isDesktop ? '$md' : '$sm'} style={{ flex: isDesktop ? 1 : undefined, minWidth: 0 }}>
        <Text color="$accentStrong" fontSize={isDesktop ? 15 : 13} fontWeight="600" letterSpacing={1}>
          {t('tagline')}
        </Text>
        <Text
          color="$text"
          fontSize={isDesktop ? 42 : 30}
          fontWeight="600"
          lineHeight={isDesktop ? 54 : 40}
        >
          {t('headline')}
        </Text>
        <Text color="$textSecondary" fontSize={isDesktop ? 17 : 15} lineHeight={isDesktop ? 28 : 25}>
          {t('description')}
        </Text>
        <XStack pt="$sm">
          <Link href={signInHref} asChild>
            <AppButton variant="primary">{t('start')}</AppButton>
          </Link>
        </XStack>
      </YStack>

      <YStack style={{ flex: isDesktop ? 1 : undefined, width: '100%' }}>
        <HeroPreview />
      </YStack>
    </XStack>
  );
}

function HeroPreview() {
  const { t } = useTranslation('landing');
  const media = useMedia();
  const isDesktop = Boolean(media.md);

  return (
    <YStack
      bg="$surface"
      borderColor="$border"
      borderWidth={1}
      style={{
        borderRadius: 16,
        boxShadow: '0 12px 32px rgba(51, 51, 51, 0.08)',
        overflow: 'hidden',
      }}
    >
      <XStack
        bg="$surfaceMuted"
        borderBottomColor="$border"
        borderBottomWidth={1}
        px="$sm"
        py="$xs"
        gap="$xs"
        style={{ alignItems: 'center' }}
      >
        <WindowDot />
        <WindowDot />
        <WindowDot />
      </XStack>
      <Image
        accessibilityLabel={t('heroAlt')}
        resizeMode="contain"
        source={heroImage}
        style={{ height: isDesktop ? 460 : 320, width: '100%' }}
      />
    </YStack>
  );
}

function WindowDot() {
  return <YStack bg="$border" height={9} width={9} style={{ borderRadius: 9999 }} />;
}

function FeatureGrid() {
  const media = useMedia();
  const isDesktop = Boolean(media.md);
  const perRow = isDesktop ? 2 : 1;
  const rows: Feature[][] = [];

  for (let index = 0; index < features.length; index += perRow) {
    rows.push(features.slice(index, index + perRow));
  }

  return (
    <YStack gap={isDesktop ? '$lg' : '$base'} width="100%">
      {rows.map((row, rowIndex) => (
        <XStack key={rowIndex} gap={isDesktop ? '$lg' : '$base'} width="100%">
          {row.map((feature) => (
            <FeaturePanel key={feature.key} feature={feature} />
          ))}
        </XStack>
      ))}
    </YStack>
  );
}

function FeaturePanel({ feature }: { feature: Feature }) {
  const { t } = useTranslation('landing');
  const media = useMedia();
  const isDesktop = Boolean(media.md);

  return (
    <YStack flex={1} gap="$sm" style={{ minWidth: 0 }}>
      <YStack
        bg="$surface"
        borderColor="$border"
        borderWidth={1}
        style={{ borderRadius: 14, overflow: 'hidden' }}
      >
        <Image
          accessibilityLabel={t(`features.${feature.key}.alt`)}
          resizeMode="contain"
          source={feature.image}
          style={{ height: isDesktop ? 280 : 230, width: '100%' }}
        />
      </YStack>
      <YStack gap="$xs" px="$xs">
        <Text color="$text" fontSize={isDesktop ? 20 : 18} fontWeight="600" lineHeight={26}>
          {t(`features.${feature.key}.title`)}
        </Text>
        <Text color="$textSecondary" fontSize={isDesktop ? 15 : 14} lineHeight={isDesktop ? 24 : 22}>
          {t(`features.${feature.key}.description`)}
        </Text>
      </YStack>
    </YStack>
  );
}

function ProcessSection() {
  const { t } = useTranslation('landing');
  const media = useMedia();
  const isDesktop = Boolean(media.md);

  return (
    <YStack gap={isDesktop ? '$lg' : '$md'} width="100%">
      <Text color="$text" fontSize={isDesktop ? 28 : 22} fontWeight="600" lineHeight={isDesktop ? 36 : 30}>
        {t('processTitle')}
      </Text>
      {isDesktop ? <ProcessStepsRow /> : <ProcessStepsColumn />}
    </YStack>
  );
}

function ProcessStepsRow() {
  return (
    <XStack gap="$md" style={{ alignItems: 'stretch' }}>
      {steps.map((step, index) => (
        <XStack key={step} flex={1} gap="$md" style={{ alignItems: 'stretch' }}>
          <StepCard step={step} index={index} />
          {index < steps.length - 1 ? (
            <YStack style={{ alignSelf: 'center' }}>
              <ArrowRight color="$textMuted" size={18} />
            </YStack>
          ) : null}
        </XStack>
      ))}
    </XStack>
  );
}

function ProcessStepsColumn() {
  return (
    <YStack gap="$sm">
      {steps.map((step, index) => (
        <XStack key={step} gap="$sm" style={{ alignItems: 'stretch' }}>
          <YStack style={{ alignItems: 'center', width: 28 }}>
            <StepNumber index={index} />
            {index < steps.length - 1 ? (
              <YStack bg="$border" width={1} style={{ flex: 1, marginVertical: 4 }} />
            ) : null}
          </YStack>
          <StepBody step={step} />
        </XStack>
      ))}
    </YStack>
  );
}

function StepCard({ step, index }: { step: (typeof steps)[number]; index: number }) {
  const { t } = useTranslation('landing');
  return (
    <YStack
      bg="$surface"
      borderColor="$border"
      borderWidth={1}
      flex={1}
      gap="$xs"
      p="$base"
      style={{ borderRadius: 14 }}
    >
      <StepNumber index={index} />
      <Text color="$text" fontSize={16} fontWeight="600">
        {t(`steps.${step}.title`)}
      </Text>
      <Text color="$textSecondary" fontSize={14} lineHeight={21}>
        {t(`steps.${step}.description`)}
      </Text>
    </YStack>
  );
}

function StepBody({ step }: { step: (typeof steps)[number] }) {
  const { t } = useTranslation('landing');
  return (
    <YStack flex={1} gap="$xs" pb="$base">
      <Text color="$text" fontSize={16} fontWeight="600">
        {t(`steps.${step}.title`)}
      </Text>
      <Text color="$textSecondary" fontSize={14} lineHeight={21}>
        {t(`steps.${step}.description`)}
      </Text>
    </YStack>
  );
}

function StepNumber({ index }: { index: number }) {
  return (
    <YStack
      bg="$accentSoft"
      height={28}
      width={28}
      style={{ alignItems: 'center', borderRadius: 9999, justifyContent: 'center' }}
    >
      <Text color="$accentStrong" fontSize={13} fontWeight="600">
        {String(index + 1).padStart(2, '0')}
      </Text>
    </YStack>
  );
}

function FinalCtaSection() {
  const { t } = useTranslation('landing');
  const media = useMedia();
  const isDesktop = Boolean(media.md);

  return (
    <YStack
      bg="$accentSoft"
      gap="$md"
      p={isDesktop ? '$xxl' : '$xl'}
      style={{ alignItems: 'center', borderRadius: 20 }}
    >
      <Text
        color="$text"
        fontSize={isDesktop ? 30 : 24}
        fontWeight="600"
        lineHeight={isDesktop ? 38 : 32}
        style={{ textAlign: 'center', maxWidth: 720 }}
      >
        {t('finalTitle')}
      </Text>
      <Text
        color="$textSecondary"
        fontSize={isDesktop ? 16 : 15}
        lineHeight={isDesktop ? 26 : 24}
        style={{ textAlign: 'center', maxWidth: 640 }}
      >
        {t('finalDescription')}
      </Text>
      <Link href={signInHref} asChild>
        <AppButton variant="primary">{t('start')}</AppButton>
      </Link>
    </YStack>
  );
}

function LandingFooter() {
  const { t } = useTranslation('landing');
  const media = useMedia();
  const isDesktop = Boolean(media.md);

  return (
    <YStack
      borderTopColor="$border"
      borderTopWidth={1}
      gap="$sm"
      maxW={MAX_CONTENT_WIDTH}
      px={isDesktop ? '$xl' : '$base'}
      py={isDesktop ? '$xl' : '$lg'}
      width="100%"
      style={{ alignItems: 'center' }}
    >
      <Text color="$text" fontSize={15} fontWeight="600">
        shukatsu-manager
      </Text>
      <Text color="$textMuted" fontSize={13}>
        {t('tagline')}
      </Text>
      <Text color="$textMuted" fontSize={12}>
        © 2026 shukatsu-manager
      </Text>
    </YStack>
  );
}
