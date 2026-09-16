import type { TFunction } from 'i18next';

export const selectionStepTypes = [
  'es',
  'web_test',
  'interview',
  'briefing',
  'group_discussion',
  'offer_meeting',
  'other',
] as const;

export type SelectionStepType = (typeof selectionStepTypes)[number];

export const selectionStepPresetKeys = [
  'briefing',
  'es',
  'web_test',
  'coding_test',
  'group_discussion',
  'first_interview',
  'second_interview',
  'third_interview',
  'final_interview',
  'offer_meeting',
] as const;

export type SelectionStepPresetKey = (typeof selectionStepPresetKeys)[number];

export type SelectionStepStatus =
  | 'waiting_schedule'
  | 'preparing'
  | 'overdue'
  | 'waiting_result'
  | 'passed'
  | 'failed';
export type ApplicationSelectionStatus = SelectionStepStatus | null;
export type StatusFilterValue = SelectionStepStatus | 'active' | 'no_steps';

export const selectionStepTypeOptions = selectionStepTypes.map((value) => ({ value }));

export const selectionStepPresets: {
  presetKey?: SelectionStepPresetKey;
  name: string;
  type: SelectionStepType;
  custom?: boolean;
}[] = [
  { presetKey: 'briefing', name: '说明会', type: 'briefing' },
  { presetKey: 'es', name: 'ES', type: 'es' },
  { presetKey: 'web_test', name: 'Web Test', type: 'web_test' },
  { presetKey: 'coding_test', name: 'Coding Test', type: 'web_test' },
  { presetKey: 'group_discussion', name: 'GD', type: 'group_discussion' },
  { presetKey: 'first_interview', name: '一面', type: 'interview' },
  { presetKey: 'second_interview', name: '二面', type: 'interview' },
  { presetKey: 'third_interview', name: '三面', type: 'interview' },
  { presetKey: 'final_interview', name: '最终面试', type: 'interview' },
  { presetKey: 'offer_meeting', name: 'Offer面談', type: 'offer_meeting' },
  { name: '', type: 'other', custom: true },
];

export const statusFilterOptions: { value: StatusFilterValue }[] = [
  { value: 'active' },
  { value: 'waiting_schedule' },
  { value: 'preparing' },
  { value: 'overdue' },
  { value: 'waiting_result' },
  { value: 'passed' },
  { value: 'failed' },
  { value: 'no_steps' },
];

export function getStatusFilterLabel(t: TFunction, status: StatusFilterValue) {
  return status === 'active'
    ? t('selection:status.active')
    : getStatusLabel(t, status === 'no_steps' ? null : status);
}

export function getStatusLabel(
  t: TFunction,
  status: ApplicationSelectionStatus | SelectionStepStatus,
) {
  return t(`selection:status.${status ?? 'noSteps'}`);
}

export function getStepTypeLabel(t: TFunction, type: string) {
  return selectionStepTypes.includes(type as SelectionStepType)
    ? t(`selection:stepType.${type}`)
    : t('selection:stepType.other');
}

export function getPresetLabel(t: TFunction, presetKey: SelectionStepPresetKey | undefined) {
  return presetKey ? t(`selection:preset.${presetKey}`) : t('selection:preset.custom');
}

export function getSelectionStepDisplayName(
  step: { name: string; presetKey?: SelectionStepPresetKey },
  t: TFunction,
) {
  return step.presetKey ? t(`selection:preset.${step.presetKey}`) : step.name;
}

const presetKeyByCanonicalName = new Map(
  selectionStepPresets.flatMap((preset) =>
    preset.presetKey ? [[preset.name, preset.presetKey] as const] : [],
  ),
);

export function getStoredStageDisplayName(t: TFunction, name: string) {
  const presetKey = presetKeyByCanonicalName.get(name);
  return presetKey ? getPresetLabel(t, presetKey) : name;
}

const knownStageOrder = ['说明会', 'ES', 'Web Test', 'GD', '一面', '二面', '三面', '最终面试', 'Offer面談'];

export function sortStageNames(stageNames: string[]) {
  return [...stageNames].sort((a, b) => {
    const aIndex = knownStageOrder.indexOf(a);
    const bIndex = knownStageOrder.indexOf(b);

    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) -
        (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
    }

    return a.localeCompare(b);
  });
}
