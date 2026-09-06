import posthogClient, { type CapturedNetworkRequest, type CaptureResult } from 'posthog-js';

import { privacySafePathname } from './routes';
import type { AnalyticsClient } from './types';

type ProductEventProperties = {
  user_signed_up: undefined;
  application_created: { company_reused: boolean };
  selection_step_created: Parameters<AnalyticsClient['selectionStepCreated']>[0];
  selection_step_completed: Parameters<AnalyticsClient['selectionStepCompleted']>[0];
  selection_step_result_set: Parameters<AnalyticsClient['selectionStepResultSet']>[0];
  event_created: Parameters<AnalyticsClient['eventCreated']>[0];
  interview_review_saved: Parameters<AnalyticsClient['interviewReviewSaved']>[0];
  interview_question_created: Parameters<AnalyticsClient['interviewQuestionCreated']>[0];
  knowledge_item_created: Parameters<AnalyticsClient['knowledgeItemCreated']>[0];
  ai_answer_generated: Parameters<AnalyticsClient['aiAnswerGenerated']>[0];
  page_viewed: { page: Parameters<AnalyticsClient['pageViewed']>[0] };
};

const analyticsEnabled = process.env.EXPO_PUBLIC_POSTHOG_ENABLED === 'true';
const projectToken = process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
const apiHost = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim();

let initializationAttempted = false;
let initialized = false;
let identifiedUserId: string | null = null;
let recordingEnabled = false;
let lastPageViewKey: string | null = null;

function redactUrl(value: string) {
  try {
    const baseOrigin = window.location.origin;
    const url = new URL(value, baseOrigin);
    const safePath = url.origin === baseOrigin ? privacySafePathname(url.pathname) : '';
    const safeUrl = `${url.origin}${safePath}`;
    return value.startsWith('/') ? safePath || '/' : safeUrl;
  } catch {
    return value.split(/[?#]/, 1)[0];
  }
}

function redactNetworkRequest(data: CapturedNetworkRequest): CapturedNetworkRequest {
  return {
    ...data,
    name: redactUrl(data.name),
    requestBody: null,
    requestHeaders: undefined,
    responseBody: null,
    responseHeaders: undefined,
  };
}

const urlPropertyNames = [
  '$current_url',
  '$pathname',
  '$referrer',
  '$initial_current_url',
  '$initial_referrer',
] as const;

function redactEventUrls(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null;

  const properties = { ...event.properties };
  for (const propertyName of urlPropertyNames) {
    const value = properties[propertyName];
    if (typeof value === 'string') properties[propertyName] = redactUrl(value);
  }

  return { ...event, properties };
}

function getClient() {
  if (initializationAttempted) return initialized ? posthogClient : null;
  initializationAttempted = true;

  if (!analyticsEnabled || !projectToken || !apiHost || typeof window === 'undefined') {
    return null;
  }

  try {
    posthogClient.init(projectToken, {
      api_host: apiHost,
      autocapture: false,
      before_send: redactEventUrls,
      capture_dead_clicks: false,
      capture_exceptions: false,
      capture_heatmaps: false,
      capture_pageleave: false,
      capture_pageview: false,
      capture_performance: false,
      disable_capture_url_hashes: true,
      disable_session_recording: true,
      enable_recording_console_log: false,
      mask_personal_data_properties: true,
      session_recording: {
        captureJsonLd: false,
        maskAllInputs: true,
        maskCapturedNetworkRequestFn: redactNetworkRequest,
        maskTextSelector: '.ph-sensitive, [role="dialog"]',
        recordBody: false,
        recordHeaders: false,
        streamNetworkBody: false,
      },
    });
    initialized = true;
    return posthogClient;
  } catch {
    return null;
  }
}

function safely(run: (client: typeof posthogClient) => void) {
  const client = getClient();
  if (!client) return;

  try {
    run(client);
  } catch {
    // Analytics is non-critical and must never interrupt a business flow.
  }
}

function capture<EventName extends keyof ProductEventProperties>(
  eventName: EventName,
  ...properties: ProductEventProperties[EventName] extends undefined
    ? []
    : [ProductEventProperties[EventName]]
) {
  safely((client) => client.capture(eventName, properties[0]));
}

export const analytics: AnalyticsClient = {
  initialize() {
    getClient();
  },
  identify(clerkUserId) {
    if (!clerkUserId || identifiedUserId === clerkUserId) return;
    safely((client) => client.identify(clerkUserId));
    if (initialized) identifiedUserId = clerkUserId;
  },
  reset() {
    if (!identifiedUserId) return;
    safely((client) => client.reset());
    identifiedUserId = null;
    lastPageViewKey = null;
  },
  setSessionRecordingEnabled(enabled) {
    if (recordingEnabled === enabled) return;
    safely((client) => {
      if (enabled) client.startSessionRecording();
      else client.stopSessionRecording();
    });
    if (initialized) recordingEnabled = enabled;
  },
  userSignedUp() {
    capture('user_signed_up');
  },
  applicationCreated(properties) {
    capture('application_created', properties);
  },
  selectionStepCreated(properties) {
    capture('selection_step_created', properties);
  },
  selectionStepCompleted(properties) {
    capture('selection_step_completed', properties);
  },
  selectionStepResultSet(properties) {
    capture('selection_step_result_set', properties);
  },
  eventCreated(properties) {
    capture('event_created', properties);
  },
  interviewReviewSaved(properties) {
    capture('interview_review_saved', properties);
  },
  interviewQuestionCreated(properties) {
    capture('interview_question_created', properties);
  },
  knowledgeItemCreated(properties) {
    capture('knowledge_item_created', properties);
  },
  aiAnswerGenerated(properties) {
    capture('ai_answer_generated', properties);
  },
  pageViewed(page, navigationKey) {
    if (navigationKey === lastPageViewKey) return;
    lastPageViewKey = navigationKey;
    capture('page_viewed', { page });
  },
};
