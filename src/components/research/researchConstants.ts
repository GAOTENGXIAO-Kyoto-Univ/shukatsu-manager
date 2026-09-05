import type { ResearchCategory, ResearchScope } from './types';

export const researchCategoryOptions: { label: string; value: ResearchCategory }[] = [
  { label: '业务 / 产品', value: 'business' },
  { label: '企业文化', value: 'culture' },
  { label: '企业优势', value: 'strength' },
  { label: '企业弱点 / 风险', value: 'weakness' },
  { label: '志望动机素材', value: 'motivation' },
  { label: '逆質問素材', value: 'reverse_question' },
  { label: '招聘 / 岗位信息', value: 'recruiting' },
  { label: '其他', value: 'other' },
];

export function getResearchCategoryLabel(category: ResearchCategory) {
  return researchCategoryOptions.find((option) => option.value === category)?.label ?? '其他';
}

export function getResearchScope(itemApplicationId: string | undefined): ResearchScope {
  return itemApplicationId ? 'application' : 'company';
}

export function getResearchScopeLabel(
  scope: ResearchScope,
  companyName: string,
  jobTitle: string,
) {
  return scope === 'company' ? `${companyName} 共通` : `仅 ${companyName} + ${jobTitle}`;
}
