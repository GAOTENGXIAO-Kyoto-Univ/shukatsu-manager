import { MoreHorizontal } from '@tamagui/lucide-icons-2';
import { Fragment } from 'react';
import { Text, XStack, YStack } from 'tamagui';

import { AppButton } from '@/components/ui/AppButton';
import type { InterviewEvaluation, InterviewQuestionData } from './types';

type InterviewQuestionListProps = {
  items: InterviewQuestionData[];
  onOpenActions: (item: InterviewQuestionData) => void;
};

const evaluationLabels: Record<InterviewEvaluation, string> = {
  good: '回答不错',
  neutral: '一般',
  poor: '需要改进',
};

export function InterviewQuestionList({ items, onOpenActions }: InterviewQuestionListProps) {
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
              <AppButton aria-label="问题操作" variant="ghost" icon={<MoreHorizontal size={18} />} onPress={() => onOpenActions(item)} />
            </XStack>
            {item.evaluation ? (
              <XStack bg="$accentSoft" px="$sm" py="$xs" style={{ alignSelf: 'flex-start', borderRadius: 9999 }}>
                <Text color="$accentStrong" fontSize={12} fontWeight="600">{evaluationLabels[item.evaluation]}</Text>
              </XStack>
            ) : null}
            {item.answer ? <QuestionBlock label="我的回答" value={item.answer} /> : null}
            {item.note ? <QuestionBlock label="补充备注" value={item.note} muted /> : null}
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
