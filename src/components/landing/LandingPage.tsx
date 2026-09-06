import { ArrowRight } from '@tamagui/lucide-icons-2';
import { Href, Link } from 'expo-router';
import { Image, ScrollView, type ImageSourcePropType } from 'react-native';
import type { ReactNode } from 'react';
import { Text, XStack, YStack, useMedia } from 'tamagui';

import { AppButton } from '@/components/ui/AppButton';

const heroImage = require('../../../assets/section-imgs/dashboard.png') as ImageSourcePropType;

type Feature = {
  title: string;
  description: string;
  image: ImageSourcePropType;
  alt: string;
};

const features: Feature[] = [
  {
    title: '选考进度，一眼掌握',
    description:
      '集中管理每家企业、每个岗位的完整选考流程，从 ES、Web Test 到多轮面试，当前进行到哪一步随时清楚。',
    image: require('../../../assets/section-imgs/selection-timeline.png') as ImageSourcePropType,
    alt: '选考进度与选考时间线界面截图',
  },
  {
    title: '重要日程，不再遗漏',
    description:
      '统一管理面试、说明会、ES Deadline、Web Test 截止日期等事项，并通过 Dashboard 和日历快速确认接下来最需要处理的事情。',
    image: require('../../../assets/section-imgs/calendar.png') as ImageSourcePropType,
    alt: '日历与近期事项界面截图',
  },
  {
    title: '每次面试，都留下经验',
    description:
      '记录面试信息、被问到的问题、自己的回答、表现好的地方和需要改善的地方，让一次面试不只是“结束了”，而是变成下一次的准备材料。',
    image: require('../../../assets/section-imgs/interview.png') as ImageSourcePropType,
    alt: '面试复盘界面截图',
  },
  {
    title: '把经历沉淀成自己的知识库',
    description:
      '将过去的面试问题、回答、弱点和准备素材持续积累起来，逐渐形成可以反复复用的个人就活知识库。',
    image: require('../../../assets/section-imgs/knowledge.png') as ImageSourcePropType,
    alt: '知识库界面截图',
  },
];

const steps = [
  { title: '添加企业', description: '记录正在关注和应聘的企业与岗位' },
  {
    title: '管理选考步骤',
    description: '整理 ES、Web Test、面试等各项选考步骤，实时把握最新选考状态',
  },
  {
    title: '日程跟进与面试复盘',
    description: '掌握 Deadline 与下一步选考的流程，并帮助及时做好面试复盘，越战越勇',
  },
  { title: '沉淀经验', description: '根据过往面试经历浓缩成专属于你的就活知识库' },
];

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
          <AppButton variant="secondary">登录 / 注册</AppButton>
        </Link>
      </XStack>
    </YStack>
  );
}

function HeroSection() {
  const media = useMedia();
  const isDesktop = Boolean(media.md);

  return (
    <XStack
      gap={isDesktop ? '$xxl' : '$lg'}
      style={{ alignItems: 'center', flexDirection: isDesktop ? 'row' : 'column' }}
    >
      <YStack gap={isDesktop ? '$md' : '$sm'} style={{ flex: isDesktop ? 1 : undefined, minWidth: 0 }}>
        <Text color="$accentStrong" fontSize={isDesktop ? 15 : 13} fontWeight="600" letterSpacing={1}>
          面向日本就活的一站式管理工具
        </Text>
        <Text
          color="$text"
          fontSize={isDesktop ? 42 : 30}
          fontWeight="600"
          lineHeight={isDesktop ? 54 : 40}
        >
          让每一家企业、每一步选考，都在掌控之中
        </Text>
        <Text color="$textSecondary" fontSize={isDesktop ? 17 : 15} lineHeight={isDesktop ? 28 : 25}>
          集中管理企业、选考进度、日程与 Deadline、面试复盘和知识积累。
          告别散落在 Excel、备忘录和日历里的就活信息，
          随时知道自己进行到哪、接下来该做什么。
        </Text>
        <XStack pt="$sm">
          <Link href={signInHref} asChild>
            <AppButton variant="primary">开始使用</AppButton>
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
        accessibilityLabel="产品首页 Dashboard 界面截图"
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
            <FeaturePanel key={feature.title} feature={feature} />
          ))}
        </XStack>
      ))}
    </YStack>
  );
}

function FeaturePanel({ feature }: { feature: Feature }) {
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
          accessibilityLabel={feature.alt}
          resizeMode="contain"
          source={feature.image}
          style={{ height: isDesktop ? 280 : 230, width: '100%' }}
        />
      </YStack>
      <YStack gap="$xs" px="$xs">
        <Text color="$text" fontSize={isDesktop ? 20 : 18} fontWeight="600" lineHeight={26}>
          {feature.title}
        </Text>
        <Text color="$textSecondary" fontSize={isDesktop ? 15 : 14} lineHeight={isDesktop ? 24 : 22}>
          {feature.description}
        </Text>
      </YStack>
    </YStack>
  );
}

function ProcessSection() {
  const media = useMedia();
  const isDesktop = Boolean(media.md);

  return (
    <YStack gap={isDesktop ? '$lg' : '$md'} width="100%">
      <Text color="$text" fontSize={isDesktop ? 28 : 22} fontWeight="600" lineHeight={isDesktop ? 36 : 30}>
        从投递到复盘，把整个就活过程串起来
      </Text>
      {isDesktop ? <ProcessStepsRow /> : <ProcessStepsColumn />}
    </YStack>
  );
}

function ProcessStepsRow() {
  return (
    <XStack gap="$md" style={{ alignItems: 'stretch' }}>
      {steps.map((step, index) => (
        <XStack key={step.title} flex={1} gap="$md" style={{ alignItems: 'stretch' }}>
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
        <XStack key={step.title} gap="$sm" style={{ alignItems: 'stretch' }}>
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
        {step.title}
      </Text>
      <Text color="$textSecondary" fontSize={14} lineHeight={21}>
        {step.description}
      </Text>
    </YStack>
  );
}

function StepBody({ step }: { step: (typeof steps)[number] }) {
  return (
    <YStack flex={1} gap="$xs" pb="$base">
      <Text color="$text" fontSize={16} fontWeight="600">
        {step.title}
      </Text>
      <Text color="$textSecondary" fontSize={14} lineHeight={21}>
        {step.description}
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
        你的就活，不该是一堆散落的表格和备忘录。
      </Text>
      <Text
        color="$textSecondary"
        fontSize={isDesktop ? 16 : 15}
        lineHeight={isDesktop ? 26 : 24}
        style={{ textAlign: 'center', maxWidth: 640 }}
      >
        从第一家企业到最后一轮面试，把每一步进展、每一次复盘、每一点经验都积累下来。
      </Text>
      <Link href={signInHref} asChild>
        <AppButton variant="primary">开始使用</AppButton>
      </Link>
    </YStack>
  );
}

function LandingFooter() {
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
        面向日本就活的一站式管理工具
      </Text>
      <Text color="$textMuted" fontSize={12}>
        © 2026 shukatsu-manager
      </Text>
    </YStack>
  );
}
