import type { AnalyticsClient } from './types';

const noop = () => undefined;

export const analytics: AnalyticsClient = {
  initialize: noop,
  identify: noop,
  reset: noop,
  setSessionRecordingEnabled: noop,
  userSignedUp: noop,
  applicationCreated: noop,
  selectionStepCreated: noop,
  selectionStepCompleted: noop,
  selectionStepResultSet: noop,
  eventCreated: noop,
  interviewReviewSaved: noop,
  interviewQuestionCreated: noop,
  knowledgeItemCreated: noop,
  aiAnswerGenerated: noop,
  pageViewed: noop,
};
