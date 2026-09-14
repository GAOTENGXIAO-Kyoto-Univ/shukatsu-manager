import type { ResearchCategory, ResearchScope } from './types';
import type { TFunction } from 'i18next';

export const researchCategoryOptions: ResearchCategory[] = [
  'business', 'culture', 'strength', 'weakness', 'motivation', 'reverse_question', 'recruiting', 'other',
];

export function getResearchCategoryLabel(t: TFunction, category: ResearchCategory) {
  return t(`research:categories.${category}`);
}

export function getResearchScope(itemApplicationId: string | undefined): ResearchScope {
  return itemApplicationId ? 'application' : 'company';
}

export function getResearchScopeLabel(
  t: TFunction,
  scope: ResearchScope,
  companyName: string,
  jobTitle: string,
) {
  return scope === 'company'
    ? t('research:companyShared', { company: companyName })
    : t('research:applicationScope', { company: companyName, job: jobTitle });
}
