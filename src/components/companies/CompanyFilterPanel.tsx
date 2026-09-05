import { Check } from '@tamagui/lucide-icons-2';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { XStack, YStack, Text } from 'tamagui';

import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { statusFilterOptions } from '@/components/selection/selectionConstants';

import { AppliedFilters, filterApplications, getStageFilterLabel } from './filtering';
import { ResponsiveOverlay } from './ResponsiveOverlay';
import type { ApplicationListItem } from './types';

type CompanyFilterPanelProps = {
  applications: ApplicationListItem[];
  availableStages: string[];
  filters: AppliedFilters;
  keyword: string;
  onApply: (filters: AppliedFilters) => void;
  onClose: () => void;
  open: boolean;
};

const emptyFilters: AppliedFilters = {
  industry: '',
  job: '',
  stages: [],
  statuses: [],
  upcoming: null,
  eventType: null,
};

export function CompanyFilterPanel({
  applications,
  availableStages,
  filters,
  keyword,
  onApply,
  onClose,
  open,
}: CompanyFilterPanelProps) {
  const [draft, setDraft] = useState<AppliedFilters>(filters);

  const resultCount = filterApplications(applications, keyword, draft).length;
  return (
    <ResponsiveOverlay
      open={open}
      onClose={onClose}
      title="筛选条件"
      desktopPresentation="popover"
      mobileNearFullscreen
      width={380}
    >
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
      <YStack gap="$base" pb="$sm">
        <XStack style={{ justifyContent: 'flex-end' }}>
          <AppButton variant="ghost" onPress={() => setDraft(emptyFilters)}>
            重置
          </AppButton>
        </XStack>
        <YStack gap="$sm">
          <Text color="$text" fontWeight="600">
            行业
          </Text>
          <AppInput
            placeholder="输入行业关键词..."
            value={draft.industry}
            onChangeText={(value) => setDraft((current) => ({ ...current, industry: value }))}
          />
        </YStack>
        <YStack gap="$sm">
          <Text color="$text" fontWeight="600">
            岗位
          </Text>
          <AppInput
            placeholder="输入岗位关键词..."
            value={draft.job}
            onChangeText={(value) => setDraft((current) => ({ ...current, job: value }))}
          />
        </YStack>
        <YStack gap="$sm">
          <Text color="$text" fontWeight="600">
            选考状态
          </Text>
          <XStack flexWrap="wrap" gap="$sm">
            {statusFilterOptions.map((option) => (
              <FilterToggle
                key={option.value}
                label={option.label}
                selected={draft.statuses.includes(option.value)}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    statuses: toggleValue(current.statuses, option.value),
                  }))
                }
              />
            ))}
          </XStack>
        </YStack>
        {availableStages.length > 0 ? (
          <YStack gap="$sm">
            <Text color="$text" fontWeight="600">
              选考阶段
            </Text>
            <XStack flexWrap="wrap" gap="$sm">
              {availableStages.map((stage) => (
                <FilterToggle
                  key={stage}
                  label={getStageFilterLabel(stage)}
                  selected={draft.stages.includes(stage)}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      stages: toggleValue(current.stages, stage),
                    }))
                  }
                />
              ))}
            </XStack>
          </YStack>
        ) : null}
        <YStack gap="$sm">
          <Text color="$text" fontWeight="600">近期事项</Text>
          <XStack flexWrap="wrap" gap="$sm">
            {[
              { value: '3d' as const, label: '3天内' },
              { value: '7d' as const, label: '7天内' },
              { value: '14d' as const, label: '14天内' },
            ].map((option) => (
              <FilterToggle
                key={option.value}
                label={option.label}
                selected={draft.upcoming === option.value}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    upcoming: current.upcoming === option.value ? null : option.value,
                  }))
                }
              />
            ))}
          </XStack>
        </YStack>
        <YStack gap="$sm">
          <Text color="$text" fontWeight="600">事项类型</Text>
          <XStack>
            <FilterToggle
              label="截止日期"
              selected={draft.eventType === 'deadline'}
              onPress={() =>
                setDraft((current) => ({
                  ...current,
                  eventType: current.eventType === 'deadline' ? null : 'deadline',
                }))
              }
            />
          </XStack>
        </YStack>
        <AppButton variant="primary" onPress={() => onApply(draft)}>
          {`查看 ${resultCount} 个结果`}
        </AppButton>
      </YStack>
      </ScrollView>
    </ResponsiveOverlay>
  );
}

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function FilterToggle({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <XStack
      bg={selected ? '$accentStrong' : '$surfaceMuted'}
      borderColor={selected ? '$accentStrong' : '$border'}
      borderWidth={1}
      cursor="pointer"
      gap="$xs"
      onPress={onPress}
      px="$md"
      py="$xs"
      style={{ alignItems: 'center', borderRadius: 9999 }}
    >
      {selected ? <Check color="$surface" size={13} /> : null}
      <Text color={selected ? '$surface' : '$textSecondary'} fontSize={13} fontWeight="600">
        {label}
      </Text>
    </XStack>
  );
}
