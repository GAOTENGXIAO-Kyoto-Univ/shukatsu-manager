import type { ReactNode } from 'react';
import { Linking } from 'react-native';
import { Text } from 'tamagui';

const inlineTokenPattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
const linkPattern = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/;

function normalizePreviewContent(content: string) {
  return content
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s+/, '• ').replace(/^\s*(\d+)\.\s+/, '$1. '))
    .join('\n');
}

function renderInline(content: string): ReactNode[] {
  return content.split(inlineTokenPattern).filter(Boolean).map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <Text key={`${index}-${token}`} fontWeight="700">
          {token.slice(2, -2)}
        </Text>
      );
    }

    const link = token.match(linkPattern);

    if (link) {
      return (
        <Text
          key={`${index}-${token}`}
          color="$accentStrong"
          cursor="pointer"
          onPress={(event) => {
            event.stopPropagation();
            void Linking.openURL(link[2]);
          }}
          style={{ textDecorationLine: 'underline' }}
        >
          {link[1]}
        </Text>
      );
    }

    return token;
  });
}

export function ResearchMarkdownPreview({
  content,
  numberOfLines = 3,
}: {
  content: string;
  numberOfLines?: number;
}) {
  return (
    <Text color="$textSecondary" lineHeight={22} numberOfLines={numberOfLines}>
      {renderInline(normalizePreviewContent(content))}
    </Text>
  );
}
