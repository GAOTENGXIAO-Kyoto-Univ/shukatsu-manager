import type { SelectionStepType } from '@/components/selection/selectionConstants';

export type AnalyticsPage =
  | 'dashboard'
  | 'companies'
  | 'application_detail'
  | 'calendar'
  | 'interview_detail'
  | 'knowledge'
  | 'profile';

export type KnowledgeCreationSource =
  | 'manual'
  | 'interview_auto_deposit'
  | 'ai_generated_saved';

export type KnowledgeCategory = 'qa' | 'material' | 'reverse_question';

export type AnalyticsClient = {
  initialize: () => void;
  identify: (clerkUserId: string) => void;
  reset: () => void;
  setSessionRecordingEnabled: (enabled: boolean) => void;
  userSignedUp: () => void;
  applicationCreated: (properties: { company_reused: boolean }) => void;
  selectionStepCreated: (properties: { step_type: SelectionStepType }) => void;
  selectionStepCompleted: (properties: { step_type: SelectionStepType }) => void;
  selectionStepResultSet: (properties: {
    result: 'passed' | 'failed';
    step_type: SelectionStepType;
  }) => void;
  eventCreated: (properties: {
    event_kind: 'selection_step' | 'independent';
    timing_type: 'scheduled' | 'deadline';
    has_explicit_time: boolean;
  }) => void;
  interviewReviewSaved: (properties: {
    has_improvement_points: boolean;
    has_questions: boolean;
  }) => void;
  interviewQuestionCreated: (properties: {
    evaluation: 'good' | 'neutral' | 'poor' | 'unset';
    has_answer: boolean;
  }) => void;
  knowledgeItemCreated: (properties: {
    category: KnowledgeCategory;
    creation_source: KnowledgeCreationSource;
  }) => void;
  aiAnswerGenerated: (properties: { used_reference_count: number }) => void;
  pageViewed: (page: AnalyticsPage, navigationKey: string) => void;
};
