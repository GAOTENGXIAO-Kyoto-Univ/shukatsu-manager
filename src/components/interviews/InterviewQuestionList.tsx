import { MoreHorizontal } from '@tamagui/lucide-icons-2';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, XStack, YStack } from 'tamagui';

import { AppButton } from '@/components/ui/AppButton';
import type { InterviewQuestionData } from './types';

type InterviewQuestionListProps = {
  items: InterviewQuestionData[];
  onOpenActions: (item: InterviewQuestionData) => void;
};

export function InterviewQuestionList({ items, onOpenActions }: InterviewQuestionListProps) {
  const { t } = useTranslation('interview');
  return (
    <YStack>
      {items.map((item, index) => (
        <Fragment key={item.interviewQuestionId}>
          {index > 0 ? <YStack bg="$border" height={1} /> : null}
          <YStack gap="$base" py="$lg" style={{ minWidth: 0 }}>
            <XStack gap="$sm" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Text color="$text" flex={1} fontSize={18} fontWeight="600" lineHeight={27} style={{ overflowWrap: 'anywhere' }}>
                {index + 1}. {item.question}
              </Text>
              <AppButton aria-label={t('questionActions')} variant="ghost" icon={<MoreHorizontal size={18} />} onPress={() => onOpenActions(item)} />
            </XStack>
            {item.evaluation ? (
              <XStack bg="$accentSoft" px="$sm" py="$xs" style={{ alignSelf: 'flex-start', borderRadius: 9999 }}>
                <Text color="$accentStrong" fontSize={12} fontWeight="600">{t(`evaluations.${item.evaluation}`)}</Text>
              </XStack>
            ) : null}
            {item.answer ? <QuestionBlock label={t('myAnswer')} value={item.answer} /> : null}
            {item.note ? <QuestionBlock label={t('note')} value={item.note} muted /> : null}
          </YStack>
        </Fragment>
      ))}
    </YStack>
  );
}

function QuestionBlock({ label, muted = false, value }: { label: string; muted?: boolean; value: string }) {
  return (
    <YStack gap="$xs" style={{ minWidth: 0 }}>
      <Text color="$textMuted" fontSize={13} fontWeight="600">{label}</Text>
      <Text color={muted ? '$textSecondary' : '$text'} lineHeight={23} style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
        {value}
      </Text>
    </YStack>
  );
}
