export const selectionStepTypeOptions = [
  { value: 'es', label: 'ES' },
  { value: 'web_test', label: 'Web Test' },
  { value: 'interview', label: '面试' },
  { value: 'briefing', label: '说明会' },
  { value: 'group_discussion', label: 'GD' },
  { value: 'offer_meeting', label: 'Offer面談' },
  { value: 'other', label: '其他' },
] as const;

export type SelectionStepType = (typeof selectionStepTypeOptions)[number]['value'];
export type SelectionStepStatus =
  | 'waiting_schedule'
  | 'preparing'
  | 'overdue'
  | 'waiting_result'
  | 'passed'
  | 'failed';
export type ApplicationSelectionStatus = SelectionStepStatus | null;
export type StatusFilterValue = SelectionStepStatus | 'active' | 'no_steps';

export const selectionStepPresets: {
  label: string;
  name: string;
  type: SelectionStepType;
  custom?: boolean;
}[] = [
  { label: '说明会', name: '说明会', type: 'briefing' },
  { label: 'ES', name: 'ES', type: 'es' },
  { label: 'Web Test', name: 'Web Test', type: 'web_test' },
  { label: 'GD', name: 'GD', type: 'group_discussion' },
  { label: '一面', name: '一面', type: 'interview' },
  { label: '二面', name: '二面', type: 'interview' },
  { label: '三面', name: '三面', type: 'interview' },
  { label: '最终面试', name: '最终面试', type: 'interview' },
  { label: 'Offer面談', name: 'Offer面談', type: 'offer_meeting' },
  { label: '其他', name: '', type: 'other', custom: true },
];

export const statusFilterOptions: { value: StatusFilterValue; label: string }[] = [
  { value: 'active', label: '选考中' },
  { value: 'waiting_schedule', label: '待安排' },
  { value: 'preparing', label: '准备中' },
  { value: 'overdue', label: '已超时' },
  { value: 'waiting_result', label: '等待结果' },
  { value: 'passed', label: '通过' },
  { value: 'failed', label: '未通过' },
  { value: 'no_steps', label: '尚未设置选考流程' },
];

export function getStatusFilterLabel(status: StatusFilterValue) {
  return status === 'active' ? '选考中' : getStatusLabel(status === 'no_steps' ? null : status);
}

export function getStatusLabel(status: ApplicationSelectionStatus | SelectionStepStatus) {
  switch (status) {
    case 'waiting_schedule':
      return '待安排';
    case 'preparing':
      return '准备中';
    case 'overdue':
      return '已超时';
    case 'waiting_result':
      return '等待结果';
    case 'passed':
      return '通过';
    case 'failed':
      return '未通过';
    case null:
      return '尚未设置选考流程';
  }
}

export function getStepTypeLabel(type: string) {
  return selectionStepTypeOptions.find((option) => option.value === type)?.label ?? '其他';
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
