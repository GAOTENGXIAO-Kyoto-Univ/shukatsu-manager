import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  getOwnedApplication,
  listSelectionStepsForApplication,
} from "./lib/authorization";
import {
  compareApplicationsByAttention,
  deriveApplicationSelectionState,
  deriveSelectionStepStatus,
} from "./lib/selectionState";
import { getCurrentUserOrThrow } from "./users";
import {
  deleteInterviewDetailCascade,
  findInterviewDetailBySelectionStep,
} from "./lib/interviews";
import { deleteSelectionProgressHistory } from "./lib/selectionProgressHistory";

const duplicateApplicationMessage = "该企业下已存在相同岗位的应聘记录";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function validateOptionalUrl(value: string | null | undefined, label: string) {
  const trimmed = normalizeOptionalString(value);

  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new Error(`${label}格式不正确`);
  }

  return trimmed;
}

async function listCompaniesForCurrentUser(ctx: Parameters<typeof getCurrentUserOrThrow>[0], userId: Id<"users">) {
  return await ctx.db
    .query("companies")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
}

async function listApplicationsForCompany(ctx: Parameters<typeof getCurrentUserOrThrow>[0], companyId: Id<"companies">) {
  return await ctx.db
    .query("applications")
    .withIndex("by_companyId", (q) => q.eq("companyId", companyId))
    .collect();
}

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

async function listInterviewDetailsForSteps(
  ctx: Parameters<typeof getCurrentUserOrThrow>[0],
  steps: Doc<"selectionSteps">[],
) {
  const interviewDetails = await Promise.all(
    steps.map((step) => findInterviewDetailBySelectionStep(ctx, step._id)),
  );

  return new Set(
    interviewDetails
      .filter((detail): detail is Doc<"interviewDetails"> => detail !== null)
      .map((detail) => detail.selectionStepId.toString()),
  );
}

async function toListItem(
  ctx: Parameters<typeof getCurrentUserOrThrow>[0],
  application: Doc<"applications">,
  company: Doc<"companies">,
  now: number,
) {
  const selectionSteps = await listSelectionStepsForApplication(ctx, application._id);
  const eventsByStep = await listEventsForSteps(ctx, selectionSteps);
  const selectionState = deriveApplicationSelectionState(selectionSteps, eventsByStep, now);

  return {
    applicationId: application._id,
    companyId: company._id,
    companyName: company.name,
    companyIndustry: company.industry,
    jobTitle: application.jobTitle,
    createdAt: application._creationTime,
    updatedAt: application.updatedAt,
    currentStage: selectionState.currentStage,
    currentStatus: selectionState.currentStatus,
    nextEvent: selectionState.nextEvent
      ? {
          eventId: selectionState.nextEvent.eventId,
          selectionStepId: selectionState.nextEvent.selectionStepId,
          stepName: selectionState.nextEvent.stepName,
          stepType: selectionState.nextEvent.stepType,
          stepOrder: selectionState.nextEvent.stepOrder,
          timingType: selectionState.nextEvent.timingType,
          datetime: selectionState.nextEvent.datetime,
          hasExplicitTime: selectionState.nextEvent.hasExplicitTime,
          isOverdue: selectionState.nextEvent.isOverdue,
        }
      : null,
  };
}

function toEventDetail(event: Doc<"events"> | null, selectionStepId: Id<"selectionSteps">) {
  return event
    ? {
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
      }
    : null;
}

function toSelectionStepDetail(
  step: Doc<"selectionSteps">,
  event: Doc<"events"> | null,
  hasInterviewDetail: boolean,
  now: number,
) {
  return {
    selectionStepId: step._id,
    applicationId: step.applicationId,
    name: step.name,
    type: step.type,
    order: step.order,
    completed: step.completed,
    result: step.result,
    status: deriveSelectionStepStatus(step, event, now),
    event: toEventDetail(event, step._id),
    hasInterviewDetail,
    createdAt: step._creationTime,
    updatedAt: step.updatedAt,
  };
}

export const list = query({
  args: { timeBucket: v.optional(v.number()) },
  handler: async (ctx) => {
    const now = Date.now();
    const user = await getCurrentUserOrThrow(ctx);
    const companies = await listCompaniesForCurrentUser(ctx, user._id);
    const items = [];

    for (const company of companies) {
      const applications = await listApplicationsForCompany(ctx, company._id);

      for (const application of applications) {
        items.push(await toListItem(ctx, application, company, now));
      }
    }

    return items.sort((a, b) => compareApplicationsByAttention(a, b, now));
  },
});

export const get = query({
  args: {
    applicationId: v.id("applications"),
    timeBucket: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const owned = await getOwnedApplication(ctx, args.applicationId);

    if (!owned) {
      return null;
    }

    const selectionSteps = await listSelectionStepsForApplication(ctx, owned.application._id);
    const [eventsByStep, interviewStepIds] = await Promise.all([
      listEventsForSteps(ctx, selectionSteps),
      listInterviewDetailsForSteps(ctx, selectionSteps),
    ]);
    const selectionState = deriveApplicationSelectionState(selectionSteps, eventsByStep, now);

    return {
      applicationId: owned.application._id,
      companyId: owned.company._id,
      jobTitle: owned.application.jobTitle,
      preferenceLevel: owned.application.preferenceLevel,
      location: owned.application.location,
      applicationUrl: owned.application.applicationUrl,
      mypageUrl: owned.application.mypageUrl,
      memo: owned.application.memo,
      createdAt: owned.application._creationTime,
      updatedAt: owned.application.updatedAt,
      company: {
        companyId: owned.company._id,
        name: owned.company.name,
        industry: owned.company.industry,
        websiteUrl: owned.company.websiteUrl,
      },
      selectionSteps: selectionSteps.map((step) => {
        const event = eventsByStep.get(step._id.toString()) ?? null;
        return toSelectionStepDetail(
          step,
          event,
          interviewStepIds.has(step._id.toString()),
          now,
        );
      }),
      currentStage: selectionState.currentStage,
      currentStatus: selectionState.currentStatus,
      nextEvent: selectionState.nextEvent,
    };
  },
});

export const create = mutation({
  args: {
    company: v.union(
      v.object({
        kind: v.literal("existing"),
        companyId: v.id("companies"),
      }),
      v.object({
        kind: v.literal("new"),
        name: v.string(),
      }),
    ),
    jobTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const jobTitle = args.jobTitle.trim();

    if (!jobTitle) {
      throw new Error("应聘岗位不能为空");
    }

    let companyId: Id<"companies">;
    let companyReused = false;

    if (args.company.kind === "existing") {
      const existingCompany = await ctx.db.get(args.company.companyId);

      if (!existingCompany || existingCompany.userId !== user._id) {
        throw new Error("企业不存在");
      }

      companyId = existingCompany._id;
      companyReused = true;
    } else {
      const companyName = args.company.name.trim();

      if (!companyName) {
        throw new Error("企业名称不能为空");
      }

      const companies = await listCompaniesForCurrentUser(ctx, user._id);
      const matchedCompany = companies.find(
        (company) => normalize(company.name) === normalize(companyName),
      );

      if (matchedCompany) {
        companyId = matchedCompany._id;
        companyReused = true;
      } else {
        companyId = await ctx.db.insert("companies", {
          userId: user._id,
          name: companyName,
          updatedAt: Date.now(),
        });
      }
    }

    const applications = await listApplicationsForCompany(ctx, companyId);
    const duplicate = applications.some(
      (application) => normalize(application.jobTitle) === normalize(jobTitle),
    );

    if (duplicate) {
      throw new Error(duplicateApplicationMessage);
    }

    const applicationId = await ctx.db.insert("applications", {
      companyId,
      jobTitle,
      updatedAt: Date.now(),
    });

    return { applicationId, companyReused };
  },
});

export const remove = mutation({
  args: {
    applicationId: v.id("applications"),
  },
  handler: async (ctx, args) => {
    const owned = await getOwnedApplication(ctx, args.applicationId);

    if (!owned) {
      throw new Error("应聘记录不存在");
    }

    const researchItems = await ctx.db
      .query("researchItems")
      .withIndex("by_application_id", (q) => q.eq("applicationId", owned.application._id))
      .collect();

    for (const researchItem of researchItems) {
      await ctx.db.delete(researchItem._id);
    }

    const selectionSteps = await listSelectionStepsForApplication(ctx, owned.application._id);

    for (const selectionStep of selectionSteps) {
      const event = await ctx.db
        .query("events")
        .withIndex("by_selectionStepId", (q) => q.eq("selectionStepId", selectionStep._id))
        .unique();

      if (event) {
        await ctx.db.delete(event._id);
      }

      const interviewDetail = await findInterviewDetailBySelectionStep(ctx, selectionStep._id);

      if (interviewDetail) {
        await deleteInterviewDetailCascade(ctx, interviewDetail);
      }

      await deleteSelectionProgressHistory(ctx, selectionStep._id);
      await ctx.db.delete(selectionStep._id);
    }

    await ctx.db.delete(owned.application._id);
  },
});

export const update = mutation({
  args: {
    applicationId: v.id("applications"),
    jobTitle: v.string(),
    preferenceLevel: v.union(v.null(), v.number()),
    location: v.union(v.null(), v.string()),
    applicationUrl: v.union(v.null(), v.string()),
    mypageUrl: v.union(v.null(), v.string()),
    memo: v.union(v.null(), v.string()),
  },
  handler: async (ctx, args) => {
    const owned = await getOwnedApplication(ctx, args.applicationId);

    if (!owned) {
      throw new Error("应聘记录不存在");
    }

    const jobTitle = args.jobTitle.trim();

    if (!jobTitle) {
      throw new Error("应聘岗位不能为空");
    }

    const preferenceLevel =
      args.preferenceLevel === null || args.preferenceLevel === undefined
        ? undefined
        : args.preferenceLevel;

    if (
      preferenceLevel !== undefined &&
      (!Number.isInteger(preferenceLevel) || preferenceLevel < 1 || preferenceLevel > 5)
    ) {
      throw new Error("志望度必须是 1–5");
    }

    const applications = await listApplicationsForCompany(ctx, owned.company._id);
    const duplicate = applications.some(
      (application) =>
        application._id !== owned.application._id &&
        normalize(application.jobTitle) === normalize(jobTitle),
    );

    if (duplicate) {
      throw new Error(duplicateApplicationMessage);
    }

    const location = normalizeOptionalString(args.location);
    const applicationUrl = validateOptionalUrl(args.applicationUrl, "招聘职位页面");
    const mypageUrl = validateOptionalUrl(args.mypageUrl, "MyPage 链接");
    const memo = normalizeOptionalString(args.memo);

    await ctx.db.replace(owned.application._id, {
      companyId: owned.application.companyId,
      jobTitle,
      ...(preferenceLevel !== undefined ? { preferenceLevel } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(applicationUrl !== undefined ? { applicationUrl } : {}),
      ...(mypageUrl !== undefined ? { mypageUrl } : {}),
      ...(memo !== undefined ? { memo } : {}),
      updatedAt: Date.now(),
    });
  },
});
