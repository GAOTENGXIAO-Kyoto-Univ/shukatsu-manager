import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { getJapanDayStartAfter } from "./lib/eventTime";
import { listSelectionStepsForApplication } from "./lib/authorization";
import { deriveApplicationSelectionState } from "./lib/selectionState";
import { getCurrentUserOrThrow } from "./users";

type UpcomingItem =
  | {
      eventId: Id<"events">;
      kind: "selection";
      group: "today" | "tomorrow" | "future";
      datetime: number;
      timingType: "scheduled" | "deadline";
      hasExplicitTime: boolean;
      companyName: string;
      jobTitle: string;
      selectionStepName: string;
      applicationId: Id<"applications">;
      selectionStepId: Id<"selectionSteps">;
      createdAt: number;
    }
  | {
      eventId: Id<"events">;
      kind: "independent";
      group: "today" | "tomorrow" | "future";
      datetime: number;
      timingType: "scheduled" | "deadline";
      hasExplicitTime: boolean;
      title: string;
      createdAt: number;
    };

async function listEventsForSteps(
  ctx: Parameters<typeof getCurrentUserOrThrow>[0],
  steps: Doc<"selectionSteps">[],
) {
  const events = await Promise.all(
    steps.map((step) =>
      ctx.db
        .query("events")
        .withIndex("by_selectionStepId", (q) => q.eq("selectionStepId", step._id))
        .unique(),
    ),
  );

  return new Map(
    events
      .filter(
        (event): event is Doc<"events"> & { selectionStepId: Id<"selectionSteps"> } =>
          event !== null && event.selectionStepId !== undefined,
      )
      .map((event) => [event.selectionStepId.toString(), event]),
  );
}

export const listUpcomingItems = query({
  args: { timeBucket: v.optional(v.number()), retryToken: v.optional(v.number()) },
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const now = Date.now();
    const tomorrowStart = getJapanDayStartAfter(now, 1);
    const futureStart = getJapanDayStartAfter(now, 2);
    const windowEnd = getJapanDayStartAfter(now, 8);
    const events = await ctx.db
      .query("events")
      .withIndex("by_userId_datetime", (q) =>
        q.eq("userId", user._id).gt("datetime", now).lt("datetime", windowEnd),
      )
      .collect();
    const eligible: UpcomingItem[] = [];

    for (const event of events) {
      const group =
        event.datetime < tomorrowStart
          ? "today"
          : event.datetime < futureStart
            ? "tomorrow"
            : "future";
      const common = {
        eventId: event._id,
        group,
        datetime: event.datetime,
        timingType: event.timingType,
        hasExplicitTime: event.hasExplicitTime,
        createdAt: event._creationTime,
      } as const;

      if (!event.selectionStepId) {
        if (event.title?.trim()) {
          eligible.push({ kind: "independent", ...common, title: event.title });
        }
        continue;
      }

      const selectionStep = await ctx.db.get(event.selectionStepId);
      if (!selectionStep || selectionStep.completed || selectionStep.result !== null) continue;
      const application = await ctx.db.get(selectionStep.applicationId);
      const company = application ? await ctx.db.get(application.companyId) : null;
      if (!application || !company || company.userId !== user._id) continue;

      eligible.push({
        kind: "selection",
        ...common,
        companyName: company.name,
        jobTitle: application.jobTitle,
        selectionStepName: selectionStep.name,
        applicationId: application._id,
        selectionStepId: selectionStep._id,
      });
    }

    eligible.sort(
      (left, right) => left.datetime - right.datetime || left.createdAt - right.createdAt,
    );

    return {
      items: eligible.slice(0, 5).map(({ createdAt, ...item }) => {
        void createdAt;
        return item;
      }),
      hasMore: eligible.length > 5,
    };
  },
});

export const getSelectionSummary = query({
  args: { timeBucket: v.optional(v.number()), retryToken: v.optional(v.number()) },
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const now = Date.now();
    const companies = await ctx.db
      .query("companies")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    let activeCount = 0;
    let interviewCount = 0;
    let waitingCount = 0;

    for (const company of companies) {
      const applications = await ctx.db
        .query("applications")
        .withIndex("by_companyId", (q) => q.eq("companyId", company._id))
        .collect();

      for (const application of applications) {
        const steps = await listSelectionStepsForApplication(ctx, application._id);
        if (steps.length === 0) continue;
        const eventsByStep = await listEventsForSteps(ctx, steps);
        const state = deriveApplicationSelectionState(steps, eventsByStep, now);
        if (state.currentStatus !== "failed") activeCount += 1;
        if (state.currentStage?.type === "interview" && state.currentStatus !== "failed") {
          interviewCount += 1;
        }
        if (state.currentStatus === "waiting_result") waitingCount += 1;
      }
    }

    return { activeCount, interviewCount, waitingCount };
  },
});

export const listRecentProgress = query({
  args: { timeBucket: v.optional(v.number()), retryToken: v.optional(v.number()) },
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const now = Date.now();
    const windowStart = now - 7 * 24 * 60 * 60 * 1000;
    const history = await ctx.db
      .query("selectionProgressHistory")
      .withIndex("by_user_id_occurred_at", (q) =>
        q.eq("userId", user._id).gte("occurredAt", windowStart).lte("occurredAt", now),
      )
      .collect();
    const latestByStep = new Map<string, Doc<"selectionProgressHistory">>();

    for (const item of history) {
      if (item.invalidatedAt !== undefined) continue;
      const key = item.selectionStepId.toString();
      const current = latestByStep.get(key);
      if (
        !current ||
        item.occurredAt > current.occurredAt ||
        (item.occurredAt === current.occurredAt && item.createdAt > current.createdAt)
      ) {
        latestByStep.set(key, item);
      }
    }

    const candidates = [...latestByStep.values()]
      .filter(
        (item): item is Doc<"selectionProgressHistory"> & { type: "completed" | "passed" } =>
          item.type === "completed" || item.type === "passed",
      )
      .sort(
        (left, right) =>
          right.occurredAt - left.occurredAt || right.createdAt - left.createdAt,
      );
    const items = [];

    for (const item of candidates) {
      const selectionStep = await ctx.db.get(item.selectionStepId);
      const application = selectionStep ? await ctx.db.get(selectionStep.applicationId) : null;
      const company = application ? await ctx.db.get(application.companyId) : null;
      if (!selectionStep || !application || !company || company.userId !== user._id) continue;

      items.push({
        progressHistoryId: item._id,
        type: item.type,
        companyName: company.name,
        jobTitle: application.jobTitle,
        selectionStepName: selectionStep.name,
      });
      if (items.length === 5) break;
    }

    return items;
  },
});
