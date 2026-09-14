/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as applications from "../applications.js";
import type * as companies from "../companies.js";
import type * as dashboard from "../dashboard.js";
import type * as events from "../events.js";
import type * as interviewQuestions from "../interviewQuestions.js";
import type * as interviews from "../interviews.js";
import type * as knowledgeAi from "../knowledgeAi.js";
import type * as knowledgeAiData from "../knowledgeAiData.js";
import type * as knowledgeItems from "../knowledgeItems.js";
import type * as knowledgeMaintenance from "../knowledgeMaintenance.js";
import type * as knowledgeOverview from "../knowledgeOverview.js";
import type * as lib_authorization from "../lib/authorization.js";
import type * as lib_deepseek from "../lib/deepseek.js";
import type * as lib_eventTime from "../lib/eventTime.js";
import type * as lib_interviews from "../lib/interviews.js";
import type * as lib_knowledge from "../lib/knowledge.js";
import type * as lib_knowledgeAggregates from "../lib/knowledgeAggregates.js";
import type * as lib_locales from "../lib/locales.js";
import type * as lib_selectionPresets from "../lib/selectionPresets.js";
import type * as lib_selectionProgressHistory from "../lib/selectionProgressHistory.js";
import type * as lib_selectionState from "../lib/selectionState.js";
import type * as migrations from "../migrations.js";
import type * as questionGroups from "../questionGroups.js";
import type * as researchItems from "../researchItems.js";
import type * as selectionSteps from "../selectionSteps.js";
import type * as users from "../users.js";
import type * as weaknessGroups from "../weaknessGroups.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  applications: typeof applications;
  companies: typeof companies;
  dashboard: typeof dashboard;
  events: typeof events;
  interviewQuestions: typeof interviewQuestions;
  interviews: typeof interviews;
  knowledgeAi: typeof knowledgeAi;
  knowledgeAiData: typeof knowledgeAiData;
  knowledgeItems: typeof knowledgeItems;
  knowledgeMaintenance: typeof knowledgeMaintenance;
  knowledgeOverview: typeof knowledgeOverview;
  "lib/authorization": typeof lib_authorization;
  "lib/deepseek": typeof lib_deepseek;
  "lib/eventTime": typeof lib_eventTime;
  "lib/interviews": typeof lib_interviews;
  "lib/knowledge": typeof lib_knowledge;
  "lib/knowledgeAggregates": typeof lib_knowledgeAggregates;
  "lib/locales": typeof lib_locales;
  "lib/selectionPresets": typeof lib_selectionPresets;
  "lib/selectionProgressHistory": typeof lib_selectionProgressHistory;
  "lib/selectionState": typeof lib_selectionState;
  migrations: typeof migrations;
  questionGroups: typeof questionGroups;
  researchItems: typeof researchItems;
  selectionSteps: typeof selectionSteps;
  users: typeof users;
  weaknessGroups: typeof weaknessGroups;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
