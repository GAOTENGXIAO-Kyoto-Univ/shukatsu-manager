import { v } from "convex/values";

import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";
import {
  getOwnedInterviewQuestion,
  getOwnedSelectionStep,
} from "./lib/authorization";
import { findInterviewDetailBySelectionStep } from "./lib/interviews";
import {
  autoDepositKnowledgeItem,
  cleanupQuestionGroupIfEmpty,
  detachKnowledgeItemSource,
} from "./lib/knowledge";

const evaluationValidator = v.union(
  v.literal("good"),
  v.literal("neutral"),
  v.literal("poor"),
);

const optionalTextValidator = v.optional(v.union(v.null(), v.string()));

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeQuestion(value: string) {
  const question = value.trim();

  if (!question) {
    throw new Error("问题不能为空");
  }

  return question;
}

export const create = mutation({
  args: {
    selectionStepId: v.id("selectionSteps"),
    question: v.string(),
    answer: optionalTextValidator,
    evaluation: v.optional(v.union(v.null(), evaluationValidator)),
    note: optionalTextValidator,
  },
  handler: async (ctx, args) => {
    const owned = await getOwnedSelectionStep(ctx, args.selectionStepId);

    if (!owned) {
      throw new Error("面试记录不存在");
    }

    if (owned.selectionStep.type !== "interview") {
      throw new Error("该选考步骤不是面试类型");
    }

    let interviewDetail = await findInterviewDetailBySelectionStep(ctx, owned.selectionStep._id);
    const now = Date.now();

    if (!interviewDetail) {
      const interviewDetailId = await ctx.db.insert("interviewDetails", {
        selectionStepId: owned.selectionStep._id,
        updatedAt: now,
      });
      interviewDetail = await ctx.db.get(interviewDetailId);
    }

    if (!interviewDetail) {
      throw new Error("面试记录创建失败");
    }

    const questionId = await ctx.db.insert("interviewQuestions", {
      interviewDetailId: interviewDetail._id,
      question: normalizeQuestion(args.question),
      answer: normalizeOptionalText(args.answer),
      evaluation: args.evaluation ?? undefined,
      note: normalizeOptionalText(args.note),
      updatedAt: now,
    });
    const question = await ctx.db.get(questionId);

    if (!question) {
      throw new Error("面试问题创建失败");
    }

    await autoDepositKnowledgeItem(ctx, {
      userId: owned.user._id,
      companyId: owned.company._id,
      interviewQuestion: question,
    });
    await ctx.scheduler.runAfter(0, internal.knowledgeAi.groupQuestion, {
      interviewQuestionId: question._id,
      sourceQuestion: question.question,
      sourceUpdatedAt: question.updatedAt,
    });

    return questionId;
  },
});

export const update = mutation({
  args: {
    interviewQuestionId: v.id("interviewQuestions"),
    question: v.string(),
    answer: optionalTextValidator,
    evaluation: v.optional(v.union(v.null(), evaluationValidator)),
    note: optionalTextValidator,
  },
  handler: async (ctx, args) => {
    const owned = await getOwnedInterviewQuestion(ctx, args.interviewQuestionId);

    if (!owned || owned.selectionStep.type !== "interview") {
      throw new Error("面试问题不存在");
    }

    const question = normalizeQuestion(args.question);
    const questionChanged = question !== owned.interviewQuestion.question;
    const updatedAt = Date.now();

    await ctx.db.patch(owned.interviewQuestion._id, {
      question,
      answer: normalizeOptionalText(args.answer),
      evaluation: args.evaluation ?? undefined,
      note: normalizeOptionalText(args.note),
      updatedAt,
    });

    if (questionChanged) {
      await ctx.scheduler.runAfter(0, internal.knowledgeAi.groupQuestion, {
        interviewQuestionId: owned.interviewQuestion._id,
        sourceQuestion: question,
        sourceUpdatedAt: updatedAt,
      });
    }
  },
});

export const remove = mutation({
  args: { interviewQuestionId: v.id("interviewQuestions") },
  handler: async (ctx, args) => {
    const owned = await getOwnedInterviewQuestion(ctx, args.interviewQuestionId);

    if (!owned) {
      throw new Error("面试问题不存在");
    }

    const questionGroupId = owned.interviewQuestion.questionGroupId;
    await detachKnowledgeItemSource(ctx, owned.interviewQuestion._id);
    await ctx.db.delete(owned.interviewQuestion._id);
    await cleanupQuestionGroupIfEmpty(ctx, questionGroupId);
  },
});
