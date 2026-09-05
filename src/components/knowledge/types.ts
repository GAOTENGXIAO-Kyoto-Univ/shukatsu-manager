import type { Id } from '../../../convex/_generated/dataModel';

export type KnowledgeCategory = 'qa' | 'material' | 'reverse_question';

export type KnowledgeItemData = {
  knowledgeItemId: Id<'knowledgeItems'>;
  category: KnowledgeCategory;
  title: string;
  content?: string;
  note?: string;
  sourceCompany: { companyId: Id<'companies'>; name: string } | null;
  sourceInterview: {
    applicationId: Id<'applications'>;
    selectionStepId: Id<'selectionSteps'>;
  } | null;
  createdAt: number;
  updatedAt: number;
};
