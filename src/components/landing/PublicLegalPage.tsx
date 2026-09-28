import { Href, Link } from 'expo-router';
import { ScrollView } from 'react-native';
import { Text, YStack, useMedia } from 'tamagui';

import {
  LANDING_MAX_CONTENT_WIDTH,
  LandingFooter,
  LandingHeader,
} from '@/components/landing/LandingPage';

export type LegalSection = {
  title: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
};

type PublicLegalPageProps = {
  title: string;
  description: string;
  sections: readonly LegalSection[];
};

const homeHref = '/' as Href;

export function PublicLegalPage({ title, description, sections }: PublicLegalPageProps) {
  const media = useMedia();
  const isDesktop = Boolean(media.md);

  return (
    <YStack bg="$background" flex={1} style={{ minHeight: '100%' }}>
      <LandingHeader />
      <ScrollView style={{ flex: 1 }}>
        <YStack width="100%" style={{ alignItems: 'center' }}>
          <YStack
            gap={isDesktop ? '$xxl' : '$xl'}
            maxW={LANDING_MAX_CONTENT_WIDTH}
            px={isDesktop ? '$xl' : '$base'}
            py={isDesktop ? 72 : 48}
            width="100%"
          >
            <YStack gap="$md" style={{ maxWidth: 800 }}>
              <Link href={homeHref} asChild>
                <Text color="$accentStrong" fontSize={14} fontWeight="600">
                  ← Back to Shukatsu Manager
                </Text>
              </Link>
              <Text
                accessibilityRole="header"
                color="$text"
                fontSize={isDesktop ? 40 : 30}
                fontWeight="600"
                lineHeight={isDesktop ? 50 : 40}
              >
                {title}
              </Text>
              <Text color="$textMuted" fontSize={13}>
                Last updated: 2026-09-28
              </Text>
              <Text color="$textSecondary" fontSize={isDesktop ? 16 : 15} lineHeight={26}>
                {description}
              </Text>
            </YStack>

            <YStack gap={isDesktop ? '$xl' : '$lg'} style={{ maxWidth: 800 }}>
              {sections.map((section) => (
                <YStack key={section.title} gap="$sm">
                  <Text
                    accessibilityRole="header"
                    color="$text"
                    fontSize={isDesktop ? 22 : 19}
                    fontWeight="600"
                    lineHeight={isDesktop ? 30 : 27}
                  >
                    {section.title}
                  </Text>
                  {section.paragraphs?.map((paragraph) => (
                    <Text key={paragraph} color="$textSecondary" fontSize={15} lineHeight={25}>
                      {paragraph}
                    </Text>
                  ))}
                  {section.bullets?.length ? (
                    <YStack gap="$sm" pl="$sm">
                      {section.bullets.map((bullet) => (
                        <Text key={bullet} color="$textSecondary" fontSize={15} lineHeight={25}>
                          • {bullet}
                        </Text>
                      ))}
                    </YStack>
                  ) : null}
                </YStack>
              ))}
            </YStack>
          </YStack>
          <LandingFooter />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
