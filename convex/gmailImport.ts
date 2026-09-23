import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getOwnedApplication, getOwnedCompany, getOwnedSelectionStep, listSelectionStepsForApplication } from "./lib/authorization";
import { normalizeEventDateTime, normalizeOptionalEventText } from "./lib/eventTime";
import { recordSelectionProgressTransition } from "./lib/selectionProgressHistory";
import { selectionStepTypeValidator } from "./lib/selectionState";
import { getCurrentUserOrThrow } from "./users";

const timingTypeValidator = v.union(v.literal("scheduled"), v.literal("deadline"));
const nullableString = v.union(v.null(), v.string());
const resultValidator = v.union(v.literal("passed"), v.literal("failed"));

const companyChoiceValidator = v.union(
  v.object({
    kind: v.literal("existing"),
    companyId: v.id("companies"),
    expectedUpdatedAt: v.number(),
  }),
  v.object({ kind: v.literal("new"), name: v.string() }),
);

const applicationChoiceValidator = v.union(
  v.object({
    kind: v.literal("existing"),
    applicationId: v.id("applications"),
    expectedUpdatedAt: v.number(),
  }),
  v.object({ kind: v.literal("new"), jobTitle: v.string() }),
);

const stepChoiceValidator = v.union(
  v.object({
    kind: v.literal("existing"),
    selectionStepId: v.id("selectionSteps"),
    expectedUpdatedAt: v.number(),
  }),
  v.object({
    kind: v.literal("new"),
    name: v.string(),
    type: selectionStepTypeValidator,
  }),
);

function stale(): never {
  throw new ConvexError({ code: "GMAIL_IMPORT_STALE" });
}

function invalid(code = "GMAIL_IMPORT_INVALID"): never {
  throw new ConvexError({ code });
}

function requiredText(value: string, maximum: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) invalid();
  return normalized;
}

function comparable(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/gu, "").trim();
}

async function resolveCompany(
  ctx: MutationCtx,
  user: Doc<"users">,
  choice:
    | { kind: "existing"; companyId: Id<"companies">; expectedUpdatedAt: number }
    | { kind: "new"; name: string },
  now: number,
) {
  if (choice.kind === "existing") {
    const owned = await getOwnedCompany(ctx, choice.companyId);
    if (!owned || owned.company.updatedAt !== choice.expectedUpdatedAt) stale();
    return owned.company;
  }

  const name = requiredText(choice.name, 120);
  const companies = await ctx.db
    .query("companies")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .collect();
  if (companies.some((company) => comparable(company.name) === comparable(name))) stale();
  const companyId = await ctx.db.insert("companies", {
    userId: user._id,
    name,
    updatedAt: now,
  });
  return (await ctx.db.get(companyId))!;
}

async function resolveApplication(
  ctx: MutationCtx,
  company: Doc<"companies">,
  choice:
    | { kind: "existing"; applicationId: Id<"applications">; expectedUpdatedAt: number }
    | { kind: "new"; jobTitle: string },
  now: number,
) {
  if (choice.kind === "existing") {
    const owned = await getOwnedApplication(ctx, choice.applicationId);
    if (
      !owned ||
      owned.company._id !== company._id ||
      owned.application.updatedAt !== choice.expectedUpdatedAt
    ) stale();
    return owned.application;
  }

  const jobTitle = requiredText(choice.jobTitle, 120);
  const applications = await ctx.db
    .query("applications")
    .withIndex("by_companyId", (q) => q.eq("companyId", company._id))
    .collect();
  if (applications.some((application) => comparable(application.jobTitle) === comparable(jobTitle))) {
    stale();
  }
  const applicationId = await ctx.db.insert("applications", {
    companyId: company._id,
    jobTitle,
    updatedAt: now,
  });
  return (await ctx.db.get(applicationId))!;
}

async function resolveStep(
  ctx: MutationCtx,
  application: Doc<"applications">,
  choice:
    | { kind: "existing"; selectionStepId: Id<"selectionSteps">; expectedUpdatedAt: number }
    | { kind: "new"; name: string; type: Doc<"selectionSteps">["type"] },
  now: number,
  insertionIndex?: number,
) {
  if (choice.kind === "existing") {
    const owned = await getOwnedSelectionStep(ctx, choice.selectionStepId);
    if (
      !owned ||
      owned.application._id !== application._id ||
      owned.selectionStep.updatedAt !== choice.expectedUpdatedAt
    ) stale();
    return owned.selectionStep;
  }

  const name = requiredText(choice.name, 120);
  const steps = await listSelectionStepsForApplication(ctx, application._id);
  const order = insertionIndex === undefined
    ? (steps.at(-1)?.order ?? -1) + 1
    : Math.max(0, Math.min(Math.trunc(insertionIndex), steps.length));
  if (insertionIndex !== undefined) {
    for (const step of [...steps].reverse()) {
      if (step.order >= order) {
        await ctx.db.patch(step._id, { order: step.order + 1, updatedAt: now });
      }
    }
  }
  const selectionStepId = await ctx.db.insert("selectionSteps", {
    applicationId: application._id,
    name,
    type: choice.type,
    order,
    completed: false,
    result: null,
    updatedAt: now,
  });
  return (await ctx.db.get(selectionStepId))!;
}

function normalizedEventFields(args: {
  timingType: "scheduled" | "deadline";
  date: string;
  time: string | null;
  location: string | null;
}) {
  return {
    ...normalizeEventDateTime(args.timingType, args.date, args.time),
    timingType: args.timingType,
    location: normalizeOptionalEventText(args.location),
  };
}

function sameEventCore(
  event: Doc<"events">,
  fields: ReturnType<typeof normalizedEventFields>,
) {
  return event.datetime === fields.datetime &&
    event.timingType === fields.timingType &&
    event.hasExplicitTime === fields.hasExplicitTime;
}

export const getMatchContext = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const companies = await ctx.db
      .query("companies")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return await Promise.all(
      companies.map(async (company) => {
        const applications = await ctx.db
          .query("applications")
          .withIndex("by_companyId", (q) => q.eq("companyId", company._id))
          .collect();
        return {
          companyId: company._id,
          name: company.name,
          updatedAt: company.updatedAt,
          applications: await Promise.all(
            applications.map(async (application) => {
              const steps = await listSelectionStepsForApplication(ctx, application._id);
              return {
                applicationId: application._id,
                jobTitle: application.jobTitle,
                updatedAt: application.updatedAt,
                steps: await Promise.all(
                  steps.map(async (step) => {
                    const event = await ctx.db
                      .query("events")
                      .withIndex("by_selectionStepId", (q) => q.eq("selectionStepId", step._id))
                      .unique();
                    return {
                      selectionStepId: step._id,
                      name: step.name,
                      type: step.type,
                      order: step.order,
                      completed: step.completed,
                      result: step.result,
                      updatedAt: step.updatedAt,
                      event: event
                        ? {
                            eventId: event._id,
                            datetime: event.datetime,
                            timingType: event.timingType,
                            hasExplicitTime: event.hasExplicitTime,
                            location: event.location,
                            updatedAt: event.updatedAt,
                          }
                        : null,
                    };
                  }),
                ),
              };
            }),
          ),
        };
      }),
    );
  },
});

export const commit = mutation({
  args: {
    company: companyChoiceValidator,
    application: applicationChoiceValidator,
    targetStep: v.optional(stepChoiceValidator),
    historicalStep: v.optional(v.object({
      step: stepChoiceValidator,
      insertionIndex: v.optional(v.number()),
      applyResult: v.boolean(),
      result: v.optional(resultValidator),
    })),
    mainEvent: v.optional(v.object({
      date: v.string(),
      time: nullableString,
      timingType: timingTypeValidator,
      location: nullableString,
      resolution: v.union(
        v.literal("create"),
        v.literal("noop"),
        v.literal("keep"),
        v.literal("update"),
      ),
      expectedEventId: v.optional(v.id("events")),
      expectedEventUpdatedAt: v.optional(v.number()),
    })),
    secondaryEvents: v.array(v.object({
      title: v.string(),
      date: v.string(),
      time: nullableString,
      timingType: timingTypeValidator,
      location: nullableString,
    })),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    if (args.secondaryEvents.length > 20) invalid();
    const now = Date.now();
    const company = await resolveCompany(ctx, user, args.company, now);
    const application = await resolveApplication(ctx, company, args.application, now);

    const targetStep = args.targetStep
      ? await resolveStep(ctx, application, args.targetStep, now)
      : null;
    const historicalStep = args.historicalStep
      ? await resolveStep(
          ctx,
          application,
          args.historicalStep.step,
          now,
          args.historicalStep.insertionIndex,
        )
      : null;

    if (historicalStep && targetStep && historicalStep._id === targetStep._id) invalid();

    if (historicalStep && args.historicalStep?.applyResult) {
      if (!args.historicalStep.result) invalid();
      const before = { completed: historicalStep.completed, result: historicalStep.result };
      const after = { completed: true, result: args.historicalStep.result };
      if (before.completed !== after.completed || before.result !== after.result) {
        await ctx.db.patch(historicalStep._id, { ...after, updatedAt: now });
        await recordSelectionProgressTransition(ctx, {
          userId: user._id,
          selectionStepId: historicalStep._id,
          before,
          after,
          now,
        });
      }
    }

    if (args.mainEvent) {
      if (!targetStep) invalid();
      const currentEvent = await ctx.db
        .query("events")
        .withIndex("by_selectionStepId", (q) => q.eq("selectionStepId", targetStep._id))
        .unique();
      const expectedId = args.mainEvent.expectedEventId;
      if (
        (expectedId && currentEvent?._id !== expectedId) ||
        (!expectedId && currentEvent) ||
        (currentEvent && args.mainEvent.expectedEventUpdatedAt !== currentEvent.updatedAt)
      ) stale();

      const fields = normalizedEventFields(args.mainEvent);
      if (args.mainEvent.resolution === "create") {
        if (currentEvent) stale();
        await ctx.db.insert("events", {
          userId: user._id,
          selectionStepId: targetStep._id,
          ...fields,
          updatedAt: now,
        });
      } else if (args.mainEvent.resolution === "noop") {
        if (!currentEvent || !sameEventCore(currentEvent, fields)) stale();
      } else if (args.mainEvent.resolution === "keep") {
        if (!currentEvent) stale();
      } else {
        if (!currentEvent) stale();
        await ctx.db.patch(currentEvent._id, {
          datetime: fields.datetime,
          timingType: fields.timingType,
          hasExplicitTime: fields.hasExplicitTime,
          updatedAt: now,
        });
      }
    }

    const secondaryEventIds: Id<"events">[] = [];
    for (const event of args.secondaryEvents) {
      const title = requiredText(event.title, 120);
      const eventId = await ctx.db.insert("events", {
        userId: user._id,
        title,
        ...normalizedEventFields(event),
        updatedAt: now,
      });
      secondaryEventIds.push(eventId);
    }

    return {
      companyId: company._id,
      companyName: company.name,
      applicationId: application._id,
      jobTitle: application.jobTitle,
      targetSelectionStepId: targetStep?._id,
      historicalSelectionStepId: historicalStep?._id,
      secondaryEventIds,
    };
  },
});
