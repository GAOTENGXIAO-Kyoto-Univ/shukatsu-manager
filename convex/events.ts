import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import {
  getOwnedSelectionStep,
  listSelectionStepsForApplication,
} from "./lib/authorization";
import {
  normalizeEventDateTime,
  normalizeMeetingUrl,
  normalizeOptionalEventText,
} from "./lib/eventTime";
import { getCurrentUserOrThrow } from "./users";

const timingTypeValidator = v.union(v.literal("scheduled"), v.literal("deadline"));
const nullableString = v.union(v.null(), v.string());

async function getEventByStep(
  ctx: Parameters<typeof getOwnedSelectionStep>[0],
  selectionStepId: Id<"selectionSteps">,
) {
  return await ctx.db
    .query("events")
    .withIndex("by_selectionStepId", (q) => q.eq("selectionStepId", selectionStepId))
    .unique();
}

async function getOwnedEvent(
  ctx: Parameters<typeof getOwnedSelectionStep>[0],
  eventId: Id<"events">,
) {
  const user = await getCurrentUserOrThrow(ctx);
  const event = await ctx.db.get(eventId);

  if (!event || (event.userId && event.userId !== user._id)) return null;

  if (event.selectionStepId) {
    const ownedStep = await getOwnedSelectionStep(ctx, event.selectionStepId);
    return ownedStep ? { kind: "selection" as const, ...ownedStep, event } : null;
  }

  return event.userId === user._id ? { kind: "independent" as const, user, event } : null;
}

function eventFields(args: {
  timingType: "scheduled" | "deadline";
  date: string;
  time: string | null;
  location: string | null;
  meetingUrl: string | null;
  note: string | null;
}) {
  const normalized = normalizeEventDateTime(args.timingType, args.date, args.time);
  const location = normalizeOptionalEventText(args.location);
  const meetingUrl = normalizeMeetingUrl(args.meetingUrl);
  const note = normalizeOptionalEventText(args.note);

  return {
    ...normalized,
    timingType: args.timingType,
    ...(location ? { location } : {}),
    ...(meetingUrl ? { meetingUrl } : {}),
    ...(note ? { note } : {}),
    updatedAt: Date.now(),
  };
}

function normalizeIndependentTitle(title: string) {
  const normalized = title.trim();
  if (!normalized) throw new Error("标题不能为空");
  return normalized;
}

const eventFormArgs = {
  timingType: timingTypeValidator,
  date: v.string(),
  time: nullableString,
  location: nullableString,
  meetingUrl: nullableString,
  note: nullableString,
};

function toEventDetail(event: Doc<"events">, selectionStepId: Id<"selectionSteps">) {
  return {
    eventId: event._id,
    selectionStepId,
    datetime: event.datetime,
    timingType: event.timingType,
    hasExplicitTime: event.hasExplicitTime,
    location: event.location,
    meetingUrl: event.meetingUrl,
    note: event.note,
    createdAt: event._creationTime,
    updatedAt: event.updatedAt,
  };
}

export const getBySelectionStep = query({
  args: { selectionStepId: v.id("selectionSteps") },
  handler: async (ctx, args) => {
    const owned = await getOwnedSelectionStep(ctx, args.selectionStepId);
    if (!owned) return null;

    const event = await getEventByStep(ctx, owned.selectionStep._id);
    return event ? toEventDetail(event, owned.selectionStep._id) : null;
  },
});

export const create = mutation({
  args: { selectionStepId: v.id("selectionSteps"), ...eventFormArgs },
  handler: async (ctx, args) => {
    const owned = await getOwnedSelectionStep(ctx, args.selectionStepId);
    if (!owned) throw new Error("选考步骤不存在");
    if (await getEventByStep(ctx, owned.selectionStep._id)) {
      throw new Error("该步骤已有时间事项");
    }

    return await ctx.db.insert("events", {
      userId: owned.user._id,
      selectionStepId: owned.selectionStep._id,
      ...eventFields(args),
    });
  },
});

export const createIndependent = mutation({
  args: { title: v.string(), ...eventFormArgs },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    return await ctx.db.insert("events", {
      userId: user._id,
      title: normalizeIndependentTitle(args.title),
      ...eventFields(args),
    });
  },
});

export const update = mutation({
  args: { eventId: v.id("events"), title: v.optional(v.string()), ...eventFormArgs },
  handler: async (ctx, args) => {
    const owned = await getOwnedEvent(ctx, args.eventId);
    if (!owned) throw new Error("时间事项不存在");

    if (owned.kind === "selection") {
      await ctx.db.replace(owned.event._id, {
        userId: owned.user._id,
        selectionStepId: owned.selectionStep._id,
        ...eventFields(args),
      });
      return;
    }

    if (args.title === undefined) throw new Error("标题不能为空");
    await ctx.db.replace(owned.event._id, {
      userId: owned.user._id,
      title: normalizeIndependentTitle(args.title),
      ...eventFields(args),
    });
  },
});

export const remove = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const owned = await getOwnedEvent(ctx, args.eventId);
    if (!owned) throw new Error("时间事项不存在");
    await ctx.db.delete(owned.event._id);
  },
});

export const listForCalendar = query({
  args: { start: v.number(), end: v.number(), retryToken: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const maximumRange = 32 * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(args.start) || !Number.isFinite(args.end) || args.start >= args.end) {
      throw new Error("日历范围不正确");
    }
    if (args.end - args.start > maximumRange) throw new Error("日历范围过大");

    const events = await ctx.db
      .query("events")
      .withIndex("by_userId_datetime", (q) =>
        q.eq("userId", user._id).gte("datetime", args.start).lt("datetime", args.end),
      )
      .collect();
    const items = [];

    for (const event of events) {
      const common = {
        eventId: event._id,
        datetime: event.datetime,
        timingType: event.timingType,
        hasExplicitTime: event.hasExplicitTime,
        location: event.location,
        meetingUrl: event.meetingUrl,
        note: event.note,
        createdAt: event._creationTime,
        updatedAt: event.updatedAt,
      };

      if (!event.selectionStepId) {
        if (!event.title?.trim()) continue;
        items.push({ kind: "independent" as const, ...common, title: event.title });
        continue;
      }

      const selectionStep = await ctx.db.get(event.selectionStepId);
      const application = selectionStep ? await ctx.db.get(selectionStep.applicationId) : null;
      const company = application ? await ctx.db.get(application.companyId) : null;
      if (!selectionStep || !application || !company || company.userId !== user._id) continue;

      items.push({
        kind: "selection" as const,
        ...common,
        selectionStepId: selectionStep._id,
        selectionStepName: selectionStep.name,
        selectionStepPresetKey: selectionStep.presetKey,
        selectionStepType: selectionStep.type,
        applicationId: application._id,
        jobTitle: application.jobTitle,
        companyName: company.name,
      });
    }

    return items.sort(
      (left, right) => left.datetime - right.datetime || left.createdAt - right.createdAt,
    );
  },
});

export const listSelectionStepTargets = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const companies = await ctx.db
      .query("companies")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const targets = [];

    for (const company of companies) {
      const applications = await ctx.db
        .query("applications")
        .withIndex("by_companyId", (q) => q.eq("companyId", company._id))
        .collect();

      for (const application of applications) {
        const steps = await listSelectionStepsForApplication(ctx, application._id);
        const stepTargets = await Promise.all(
          steps.map(async (step) => ({
            selectionStepId: step._id,
            name: step.name,
            presetKey: step.presetKey,
            type: step.type,
            order: step.order,
            completed: step.completed,
            result: step.result,
            hasEvent: Boolean(await getEventByStep(ctx, step._id)),
          })),
        );

        targets.push({
          applicationId: application._id,
          companyName: company.name,
          jobTitle: application.jobTitle,
          steps: stepTargets,
        });
      }
    }

    return targets.sort(
      (left, right) =>
        left.companyName.localeCompare(right.companyName) ||
        left.jobTitle.localeCompare(right.jobTitle),
    );
  },
});

export const backfillEventUserIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("events").collect();
    let updated = 0;
    let alreadySet = 0;
    const conflicts: Id<"events">[] = [];
    const orphanEventIds: Id<"events">[] = [];

    for (const event of events) {
      if (!event.selectionStepId) {
        if (event.userId) alreadySet += 1;
        else orphanEventIds.push(event._id);
        continue;
      }

      const step = await ctx.db.get(event.selectionStepId);
      const application = step ? await ctx.db.get(step.applicationId) : null;
      const company = application ? await ctx.db.get(application.companyId) : null;
      if (!step || !application || !company) {
        orphanEventIds.push(event._id);
        continue;
      }

      if (event.userId && event.userId !== company.userId) {
        conflicts.push(event._id);
        continue;
      }
      if (event.userId) {
        alreadySet += 1;
        continue;
      }

      await ctx.db.patch(event._id, { userId: company.userId });
      updated += 1;
    }

    return { total: events.length, updated, alreadySet, conflicts, orphanEventIds };
  },
});

export const auditEventUserIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("events").collect();
    let selectionEvents = 0;
    let independentEvents = 0;
    const missingUserIds: Id<"events">[] = [];
    const invalidShapes: Id<"events">[] = [];
    const ownershipConflicts: Id<"events">[] = [];

    for (const event of events) {
      if (!event.userId) missingUserIds.push(event._id);

      if (event.selectionStepId) {
        selectionEvents += 1;
        if (event.title !== undefined) invalidShapes.push(event._id);
        const step = await ctx.db.get(event.selectionStepId);
        const application = step ? await ctx.db.get(step.applicationId) : null;
        const company = application ? await ctx.db.get(application.companyId) : null;
        if (!step || !application || !company) invalidShapes.push(event._id);
        else if (event.userId && event.userId !== company.userId) ownershipConflicts.push(event._id);
      } else {
        independentEvents += 1;
        if (!event.title?.trim()) invalidShapes.push(event._id);
      }
    }

    return {
      total: events.length,
      selectionEvents,
      independentEvents,
      missingUserIds,
      invalidShapes: [...new Set(invalidShapes)],
      ownershipConflicts,
    };
  },
});
