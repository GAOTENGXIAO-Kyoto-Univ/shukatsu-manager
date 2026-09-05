import type { Id } from '../../../convex/_generated/dataModel';

export type ResearchCategory =
  | 'business'
  | 'culture'
  | 'strength'
  | 'weakness'
  | 'motivation'
  | 'reverse_question'
  | 'recruiting'
  | 'other';

export type ResearchScope = 'company' | 'application';

export type ResearchItemData = {
  researchItemId: Id<'researchItems'>;
  companyId: Id<'companies'>;
  applicationId?: Id<'applications'>;
  category: ResearchCategory;
  title?: string;
  content: string;
  sourceUrls?: string[];
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ResearchApplicationContext = {
  applicationId: Id<'applications'>;
  companyName: string;
  jobTitle: string;
};
