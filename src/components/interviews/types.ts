import type { Id } from '../../../convex/_generated/dataModel';
import type { EventTimingType } from '@/components/applications/types';

export type InterviewFormat = 'online' | 'offline' | 'phone' | 'other';
export type InterviewEvaluation = 'good' | 'neutral' | 'poor';

export type InterviewDetailData = {
  interviewDetailId: Id<'interviewDetails'>;
  interviewFormat?: InterviewFormat;
  interviewerCount?: number;
  durationMinutes?: number;
  interviewerInfo?: string;
  goodPoints?: string;
  improvementPoints?: string;
  nextImprovement?: string;
  overallNote?: string;
  createdAt: number;
  updatedAt: number;
};

export type InterviewQuestionData = {
  interviewQuestionId: Id<'interviewQuestions'>;
  question: string;
  answer?: string;
  evaluation?: InterviewEvaluation;
  note?: string;
  createdAt: number;
  updatedAt: number;
};

export type InterviewPageData = {
  status: 'success';
  company: {
    companyId: Id<'companies'>;
    name: string;
  };
  application: {
    applicationId: Id<'applications'>;
    jobTitle: string;
  };
  selectionStep: {
    selectionStepId: Id<'selectionSteps'>;
    name: string;
    type: 'interview';
  };
  event: {
    eventId: Id<'events'>;
    timingType: EventTimingType;
    datetime: number;
    hasExplicitTime: boolean;
  } | null;
  interviewDetail: InterviewDetailData | null;
  questions: InterviewQuestionData[];
};
