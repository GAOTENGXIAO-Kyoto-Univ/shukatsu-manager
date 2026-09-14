import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { appLocaleValidator } from "./lib/locales";
import { selectionStepPresetKeyValidator } from "./lib/selectionPresets";

export default defineSchema({
  users: defineTable({
    authUserId: v.string(),
    displayName: v.optional(v.string()),
    locale: v.optional(appLocaleValidator),
    timezone: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_authUserId", ["authUserId"]),

  companies: defineTable({
    userId: v.id("users"),
    name: v.string(),
    industry: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  applications: defineTable({
    companyId: v.id("companies"),
    jobTitle: v.string(),
    preferenceLevel: v.optional(v.number()),
    location: v.optional(v.string()),
    applicationUrl: v.optional(v.string()),
    mypageUrl: v.optional(v.string()),
    memo: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_companyId", ["companyId"]),

  selectionSteps: defineTable({
    applicationId: v.id("applications"),
    name: v.string(),
    presetKey: v.optional(selectionStepPresetKeyValidator),
    type: v.union(
      v.literal("es"),
      v.literal("web_test"),
      v.literal("interview"),
      v.literal("briefing"),
      v.literal("group_discussion"),
      v.literal("offer_meeting"),
      v.literal("other"),
    ),
    order: v.number(),
    result: v.union(v.null(), v.literal("passed"), v.literal("failed")),
    completed: v.boolean(),
    updatedAt: v.number(),
  }).index("by_applicationId_order", ["applicationId", "order"]),

  selectionProgressHistory: defineTable({
    userId: v.id("users"),
    selectionStepId: v.id("selectionSteps"),
    type: v.union(v.literal("completed"), v.literal("passed"), v.literal("failed")),
    occurredAt: v.number(),
    invalidatedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user_id_occurred_at", ["userId", "occurredAt"])
    .index("by_selection_step_id", ["selectionStepId"]),

  researchItems: defineTable({
    companyId: v.id("companies"),
    applicationId: v.optional(v.id("applications")),
    category: v.union(
      v.literal("business"),
      v.literal("culture"),
      v.literal("strength"),
      v.literal("weakness"),
      v.literal("motivation"),
      v.literal("reverse_question"),
      v.literal("recruiting"),
      v.literal("other"),
    ),
    title: v.optional(v.string()),
    content: v.string(),
    sourceUrls: v.optional(v.array(v.string())),
    isPinned: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_company_id", ["companyId"])
    .index("by_application_id", ["applicationId"]),

  events: defineTable({
    userId: v.id("users"),
    selectionStepId: v.optional(v.id("selectionSteps")),
    title: v.optional(v.string()),
    datetime: v.number(),
    timingType: v.union(v.literal("scheduled"), v.literal("deadline")),
    hasExplicitTime: v.boolean(),
    location: v.optional(v.string()),
    meetingUrl: v.optional(v.string()),
    note: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_selectionStepId", ["selectionStepId"])
    .index("by_datetime", ["datetime"])
    .index("by_userId_datetime", ["userId", "datetime"]),

  interviewDetails: defineTable({
    selectionStepId: v.id("selectionSteps"),
    interviewFormat: v.optional(
      v.union(
        v.literal("online"),
        v.literal("offline"),
        v.literal("phone"),
        v.literal("other"),
      ),
    ),
    interviewerCount: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),
    interviewerInfo: v.optional(v.string()),
    goodPoints: v.optional(v.string()),
    improvementPoints: v.optional(v.string()),
    nextImprovement: v.optional(v.string()),
    overallNote: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_selectionStepId", ["selectionStepId"]),

  interviewQuestions: defineTable({
    interviewDetailId: v.id("interviewDetails"),
    questionGroupId: v.optional(v.id("interviewQuestionGroups")),
    question: v.string(),
    answer: v.optional(v.string()),
    evaluation: v.optional(
      v.union(v.literal("good"), v.literal("neutral"), v.literal("poor")),
    ),
    note: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_interviewDetailId", ["interviewDetailId"])
    .index("by_questionGroupId", ["questionGroupId"]),

  knowledgeItems: defineTable({
    userId: v.id("users"),
    title: v.string(),
    content: v.optional(v.string()),
    category: v.union(
      v.literal("qa"),
      v.literal("reverse_question"),
      v.literal("material"),
    ),
    sourceInterviewQuestionId: v.optional(v.id("interviewQuestions")),
    sourceCompanyId: v.optional(v.id("companies")),
    note: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_sourceInterviewQuestionId", ["sourceInterviewQuestionId"]),

  interviewQuestionGroups: defineTable({
    userId: v.id("users"),
    title: v.string(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  weaknessGroups: defineTable({
    userId: v.id("users"),
    title: v.string(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  weaknessOccurrences: defineTable({
    interviewDetailId: v.id("interviewDetails"),
    weaknessGroupId: v.id("weaknessGroups"),
    extractedWeakness: v.string(),
    improvementAction: v.optional(v.string()),
  })
    .index("by_interviewDetailId", ["interviewDetailId"])
    .index("by_weaknessGroupId", ["weaknessGroupId"])
    .index("by_interviewDetailId_weaknessGroupId", [
      "interviewDetailId",
      "weaknessGroupId",
    ]),
});
