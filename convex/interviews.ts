import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import {
  getOwnedInterviewDetail,
  getOwnedSelectionStep,
} from "./lib/authorization";
import {
  deleteInterviewDetailCascade,
  findInterviewDetailBySelectionStep,
  listInterviewQuestions,
} from "./lib/interviews";
import { deleteWeaknessOccurrencesForInterview } from "./lib/knowledge";

const interviewFormatValidator = v.union(
  v.literal("online"),
  v.literal("offline"),
  v.literal("phone"),
  v.literal("other"),
);

const optionalTextValidator = v.optional(v.union(v.null(), v.string()));
const optionalPositiveIntegerValidator = v.optional(v.union(v.null(), v.number()));

const interviewFields = {
  interviewFormat: v.optional(v.union(v.null(), interviewFormatValidator)),
  interviewerCount: optionalPositiveIntegerValidator,
  durationMinutes: optionalPositiveIntegerValidator,
  interviewerInfo: optionalTextValidator,
  goodPoints: optionalTextValidator,
  improvementPoints: optionalTextValidator,
  nextImprovement: optionalTextValidator,
  overallNote: optionalTextValidator,
};

type InterviewFormat = NonNullable<Doc<"interviewDetails">["interviewFormat"]>;

type InterviewFieldArgs = {
  interviewFormat?: InterviewFormat | null;
  interviewerCount?: number | null;
  durationMinutes?: number | null;
  interviewerInfo?: string | null;
  goodPoints?: string | null;
  improvementPoints?: string | null;
  nextImprovement?: string | null;
  overallNote?: string | null;
};

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizePositiveInteger(value: number | null | undefined, label: string) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label}必须是正整数`);
  }

  return value;
}

function normalizeInterviewFields(args: InterviewFieldArgs) {
  return {
    interviewFormat: args.interviewFormat ?? undefined,
    interviewerCount: normalizePositiveInteger(args.interviewerCount, "面试官人数"),
    durationMinutes: normalizePositiveInteger(args.durationMinutes, "实际时长"),
    interviewerInfo: normalizeOptionalText(args.interviewerInfo),
    goodPoints: normalizeOptionalText(args.goodPoints),
    improvementPoints: normalizeOptionalText(args.improvementPoints),
    nextImprovement: normalizeOptionalText(args.nextImprovement),
    overallNote: normalizeOptionalText(args.overallNote),
  };
}

function normalizeInterviewPatch(args: InterviewFieldArgs) {
  const patch: Partial<
    Pick<
      Doc<"interviewDetails">,
      | "interviewFormat"
      | "interviewerCount"
      | "durationMinutes"
      | "interviewerInfo"
      | "goodPoints"
      | "improvementPoints"
      | "nextImprovement"
      | "overallNote"
    >
  > = {};

  if (args.interviewFormat !== undefined) {
    patch.interviewFormat = args.interviewFormat ?? undefined;
  }
  if (args.interviewerCount !== undefined) {
    patch.interviewerCount = normalizePositiveInteger(args.interviewerCount, "面试官人数");
  }
  if (args.durationMinutes !== undefined) {
    patch.durationMinutes = normalizePositiveInteger(args.durationMinutes, "实际时长");
  }
  if (args.interviewerInfo !== undefined) {
    patch.interviewerInfo = normalizeOptionalText(args.interviewerInfo);
  }
  if (args.goodPoints !== undefined) {
    patch.goodPoints = normalizeOptionalText(args.goodPoints);
  }
  if (args.improvementPoints !== undefined) {
    patch.improvementPoints = normalizeOptionalText(args.improvementPoints);
  }
  if (args.nextImprovement !== undefined) {
    patch.nextImprovement = normalizeOptionalText(args.nextImprovement);
  }
  if (args.overallNote !== undefined) {
    patch.overallNote = normalizeOptionalText(args.overallNote);
  }

  return patch;
}

function hasMeaningfulInterviewContent(fields: ReturnType<typeof normalizeInterviewFields>) {
  return Object.values(fields).some((value) => value !== undefined);
}

function hasMeaningfulReview(fields: Pick<
  Doc<"interviewDetails">,
  "goodPoints" | "improvementPoints" | "nextImprovement" | "overallNote"
>) {
  return Boolean(
    fields.goodPoints ||
    fields.improvementPoints ||
    fields.nextImprovement ||
    fields.overallNote
  );
}

function toInterviewDetailDto(interviewDetail: Doc<"interviewDetails">) {
  return {
    interviewDetailId: interviewDetail._id,
    interviewFormat: interviewDetail.interviewFormat,
    interviewerCount: interviewDetail.interviewerCount,
    durationMinutes: interviewDetail.durationMinutes,
    interviewerInfo: interviewDetail.interviewerInfo,
    goodPoints: interviewDetail.goodPoints,
    improvementPoints: interviewDetail.improvementPoints,
    nextImprovement: interviewDetail.nextImprovement,
    overallNote: interviewDetail.overallNote,
    createdAt: interviewDetail._creationTime,
    updatedAt: interviewDetail.updatedAt,
  };
}

export const getBySelectionStep = query({
  args: {
    applicationId: v.id("applications"),
    selectionStepId: v.id("selectionSteps"),
  },
  handler: async (ctx, args) => {
    const owned = await getOwnedSelectionStep(ctx, args.selectionStepId);

    if (!owned || owned.selectionStep.applicationId !== args.applicationId) {
      return { status: "unavailable" as const };
    }

    if (owned.selectionStep.type !== "interview") {
      return { status: "not_interview" as const };
    }

    const [event, interviewDetail] = await Promise.all([
      ctx.db
        .query("events")
        .withIndex("by_selectionStepId", (q) =>
          q.eq("selectionStepId", owned.selectionStep._id),
        )
        .unique(),
      findInterviewDetailBySelectionStep(ctx, owned.selectionStep._id),
    ]);
    const questions = interviewDetail
      ? await listInterviewQuestions(ctx, interviewDetail._id)
      : [];

    return {
      status: "success" as const,
      company: {
        companyId: owned.company._id,
        name: owned.company.name,
      },
      application: {
        applicationId: owned.application._id,
        jobTitle: owned.application.jobTitle,
      },
      selectionStep: {
        selectionStepId: owned.selectionStep._id,
        name: owned.selectionStep.name,
        presetKey: owned.selectionStep.presetKey,
        type: owned.selectionStep.type,
      },
      event: event
        ? {
            eventId: event._id,
            timingType: event.timingType,
            datetime: event.datetime,
            hasExplicitTime: event.hasExplicitTime,
          }
        : null,
      interviewDetail: interviewDetail ? toInterviewDetailDto(interviewDetail) : null,
      questions: questions.map((question) => ({
        interviewQuestionId: question._id,
        question: question.question,
        answer: question.answer,
        evaluation: question.evaluation,
        note: question.note,
        createdAt: question._creationTime,
        updatedAt: question.updatedAt,
      })),
    };
  },
});

export const create = mutation({
  args: {
    selectionStepId: v.id("selectionSteps"),
    ...interviewFields,
  },
  handler: async (ctx, args) => {
    const owned = await getOwnedSelectionStep(ctx, args.selectionStepId);

    if (!owned) {
      throw new Error("面试记录不存在");
    }

    if (owned.selectionStep.type !== "interview") {
      throw new Error("该选考步骤不是面试类型");
    }

    const existing = await findInterviewDetailBySelectionStep(ctx, owned.selectionStep._id);

    if (existing) {
      throw new Error("该选考步骤已有面试记录");
    }

    const fields = normalizeInterviewFields(args);

    if (!hasMeaningfulInterviewContent(fields)) {
      throw new Error("请至少填写一项面试内容");
    }

    const updatedAt = Date.now();
    const interviewDetailId = await ctx.db.insert("interviewDetails", {
      selectionStepId: owned.selectionStep._id,
      ...fields,
      updatedAt,
    });

    if (fields.improvementPoints) {
      await ctx.scheduler.runAfter(0, internal.knowledgeAi.analyzeWeakness, {
        interviewDetailId,
        sourceImprovementPoints: fields.improvementPoints,
        sourceNextImprovement: fields.nextImprovement,
        sourceUpdatedAt: updatedAt,
      });
    }

    return {
      interviewDetailId,
      becameMeaningfulReview: hasMeaningfulReview(fields),
    };
  },
});

export const update = mutation({
  args: {
    interviewDetailId: v.id("interviewDetails"),
    ...interviewFields,
  },
  handler: async (ctx, args) => {
    const owned = await getOwnedInterviewDetail(ctx, args.interviewDetailId);

    if (!owned || owned.selectionStep.type !== "interview") {
      throw new Error("面试记录不存在");
    }

    const fields = normalizeInterviewPatch(args);

    const updatedAt = Date.now();
    const nextImprovementPoints =
      fields.improvementPoints ??
      (args.improvementPoints !== undefined ? undefined : owned.interviewDetail.improvementPoints);
    const nextImprovement =
      fields.nextImprovement ??
      (args.nextImprovement !== undefined ? undefined : owned.interviewDetail.nextImprovement);
    const improvementChanged =
      nextImprovementPoints !== owned.interviewDetail.improvementPoints ||
      nextImprovement !== owned.interviewDetail.nextImprovement;
    const nextReview = {
      goodPoints: args.goodPoints === undefined
        ? owned.interviewDetail.goodPoints
        : normalizeOptionalText(args.goodPoints),
      improvementPoints: args.improvementPoints === undefined
        ? owned.interviewDetail.improvementPoints
        : normalizeOptionalText(args.improvementPoints),
      nextImprovement: args.nextImprovement === undefined
        ? owned.interviewDetail.nextImprovement
        : normalizeOptionalText(args.nextImprovement),
      overallNote: args.overallNote === undefined
        ? owned.interviewDetail.overallNote
        : normalizeOptionalText(args.overallNote),
    };
    const becameMeaningfulReview =
      !hasMeaningfulReview(owned.interviewDetail) && hasMeaningfulReview(nextReview);

    await ctx.db.patch(owned.interviewDetail._id, {
      ...fields,
      updatedAt,
    });

    if (improvementChanged && !nextImprovementPoints) {
      await deleteWeaknessOccurrencesForInterview(ctx, owned.interviewDetail._id);
    } else if (improvementChanged && nextImprovementPoints) {
      await ctx.scheduler.runAfter(0, internal.knowledgeAi.analyzeWeakness, {
        interviewDetailId: owned.interviewDetail._id,
        sourceImprovementPoints: nextImprovementPoints,
        sourceNextImprovement: nextImprovement,
        sourceUpdatedAt: updatedAt,
      });
    }

    return { becameMeaningfulReview };
  },
});

export const remove = mutation({
  args: { interviewDetailId: v.id("interviewDetails") },
  handler: async (ctx, args) => {
    const owned = await getOwnedInterviewDetail(ctx, args.interviewDetailId);

    if (!owned) {
      throw new Error("面试记录不存在");
    }

    await deleteInterviewDetailCascade(ctx, owned.interviewDetail);
  },
});
