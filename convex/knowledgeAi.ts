import { v } from "convex/values";
import { z } from "zod";

import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { callDeepSeekJson, DeepSeekError } from "./lib/deepseek";

const questionGroupingSchema = z.object({
  match: z.boolean(),
  groupId: z.string().nullable().optional(),
  representativeTitle: z.string().optional(),
});

const titleSchema = z.object({ title: z.string().trim().min(1) });

const weaknessAnalysisSchema = z.object({
  weaknesses: z.array(z.object({
    weakness: z.string().trim().min(1),
    matchingGroupId: z.string().nullable().optional(),
    improvementAction: z.string().nullable().optional(),
  })),
});

const answerSelectionSchema = z.object({
  selectedIds: z.array(z.string()).max(5),
});

const answerDraftSchema = z.object({ draft: z.string().trim().min(1) });

type GenerateAnswerStage =
  | "load_candidates"
  | "select_materials"
  | "load_materials"
  | "generate_draft";

export const groupQuestion = internalAction({
  args: {
    interviewQuestionId: v.id("interviewQuestions"),
    sourceQuestion: v.string(),
    sourceUpdatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.knowledgeAiData.getQuestionContext, {
      interviewQuestionId: args.interviewQuestionId,
    });
    if (
      !context ||
      context.question.question !== args.sourceQuestion ||
      context.question.updatedAt !== args.sourceUpdatedAt
    ) return;

    const candidateIds = new Set(context.groups.map((group) => group.groupId.toString()));
    const result = await callDeepSeekJson({
      schema: questionGroupingSchema,
      systemPrompt: [
        "你负责保守地归组面试问题，并且必须输出 JSON。",
        "只有两道题能用基本相同的核心回答时才匹配；不确定时返回 no match。",
        "输出格式：{\"match\":boolean,\"groupId\":string|null,\"representativeTitle\":string}。",
        "若不匹配，representativeTitle 使用简洁、中性、覆盖原意的中文问题标题。",
      ].join("\n"),
      userPrompt: JSON.stringify({
        newQuestion: context.question.question,
        candidateGroups: context.groups.map((group) => ({ id: group.groupId, title: group.title })),
      }),
    });

    let matchingGroupId: Id<"interviewQuestionGroups"> | undefined;
    if (result.match) {
      if (!result.groupId || !candidateIds.has(result.groupId)) {
        throw new Error("AI returned an invalid question group");
      }
      matchingGroupId = result.groupId as Id<"interviewQuestionGroups">;
    }

    const applied = await ctx.runMutation(internal.knowledgeAiData.applyQuestionGrouping, {
      interviewQuestionId: args.interviewQuestionId,
      sourceQuestion: args.sourceQuestion,
      sourceUpdatedAt: args.sourceUpdatedAt,
      ...(matchingGroupId ? { matchingGroupId } : {}),
      ...(!matchingGroupId && result.representativeTitle
        ? { newTitle: result.representativeTitle }
        : {}),
    });

    if (applied && applied.memberCount >= 3 && applied.memberCount % 3 === 0) {
      const title = await generateRepresentativeTitle(
        "这些问题共享同一核心回答。生成一个简洁、中性、不添加新含义的中文代表问题标题，并输出 JSON。",
        applied.memberQuestions,
      );
      await ctx.runMutation(internal.knowledgeAiData.updateQuestionGroupTitle, {
        groupId: applied.groupId,
        expectedMemberCount: applied.memberCount,
        title,
      });
    }
  },
});

export const analyzeWeakness = internalAction({
  args: {
    interviewDetailId: v.id("interviewDetails"),
    sourceImprovementPoints: v.string(),
    sourceNextImprovement: v.optional(v.string()),
    sourceUpdatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.knowledgeAiData.getWeaknessContext, {
      interviewDetailId: args.interviewDetailId,
    });
    if (
      !context ||
      context.detail.updatedAt !== args.sourceUpdatedAt ||
      context.detail.improvementPoints !== args.sourceImprovementPoints ||
      context.detail.nextImprovement !== args.sourceNextImprovement
    ) return;

    const candidateIds = new Set(context.groups.map((group) => group.groupId.toString()));
    const result = await callDeepSeekJson({
      maxTokens: 1800,
      schema: weaknessAnalysisSchema,
      systemPrompt: [
        "从面试复盘中保守提取 0 到多个具体弱点，并输出 JSON。",
        "将每个弱点与候选弱点组匹配；不确定时 matchingGroupId 为 null。",
        "只为能明确对应的弱点匹配具体改进行动，不要把整段行动复制到每个弱点。",
        "输出格式：{\"weaknesses\":[{\"weakness\":string,\"matchingGroupId\":string|null,\"improvementAction\":string|null}]}。",
      ].join("\n"),
      userPrompt: JSON.stringify({
        improvementPoints: context.detail.improvementPoints,
        nextImprovement: context.detail.nextImprovement ?? null,
        candidateGroups: context.groups.map((group) => ({ id: group.groupId, title: group.title })),
      }),
    });

    const weaknesses = result.weaknesses.map((item) => {
      if (item.matchingGroupId && !candidateIds.has(item.matchingGroupId)) {
        throw new Error("AI returned an invalid weakness group");
      }
      return {
        weakness: item.weakness,
        matchingGroupId: item.matchingGroupId
          ? item.matchingGroupId as Id<"weaknessGroups">
          : null,
        improvementAction: item.improvementAction ?? null,
      };
    });

    const refreshCandidates = await ctx.runMutation(
      internal.knowledgeAiData.applyWeaknessAnalysis,
      {
        interviewDetailId: args.interviewDetailId,
        sourceImprovementPoints: args.sourceImprovementPoints,
        sourceNextImprovement: args.sourceNextImprovement,
        sourceUpdatedAt: args.sourceUpdatedAt,
        weaknesses,
      },
    );

    for (const candidate of refreshCandidates) {
      const title = await generateRepresentativeTitle(
        "这些描述属于同一面试弱点。生成一个简洁、中性、不添加新含义的中文弱点标题，并输出 JSON。",
        candidate.weaknesses,
      );
      await ctx.runMutation(internal.knowledgeAiData.updateWeaknessGroupTitle, {
        groupId: candidate.groupId,
        expectedOccurrenceCount: candidate.occurrenceCount,
        title,
      });
    }
  },
});

export const generateAnswer = action({
  args: { question: v.string() },
  handler: async (ctx, args): Promise<
    | { status: "no_material"; references: [] }
    | {
        status: "success";
        draft: string;
        references: Array<{
          knowledgeItemId: Id<"knowledgeItems">;
          title: string;
          sourceCompanyName?: string;
        }>;
      }
  > => {
    const question = args.question.trim();
    if (!question) throw new Error("问题不能为空");

    let stage: GenerateAnswerStage = "load_candidates";
    let candidateCount = 0;
    let selectedCount = 0;
    let materialCount = 0;

    try {
      const candidates = await ctx.runQuery(internal.knowledgeAiData.loadAnswerCandidates, {});
      candidateCount = candidates.length;
      if (candidates.length === 0) return { status: "no_material", references: [] };

      const candidateIds = new Set(candidates.map((item) => item.knowledgeItemId.toString()));
      stage = "select_materials";
      const selection = await callDeepSeekJson({
        schema: answerSelectionSchema,
        systemPrompt: [
          "选择与用户新问题语义严格相关的知识条目，并输出 JSON。",
          "最多选择 5 条；宁可少选，也不要选择只有宽泛话题相关的内容。",
          "输出格式：{\"selectedIds\":[string]}。",
        ].join("\n"),
        userPrompt: JSON.stringify({
          question,
          candidates: candidates.map((item) => ({ id: item.knowledgeItemId, title: item.title })),
        }),
      });
      const selectedIds = Array.from(new Set(selection.selectedIds))
        .filter((id) => candidateIds.has(id))
        .slice(0, 5) as Id<"knowledgeItems">[];
      selectedCount = selectedIds.length;
      stage = "load_materials";
      const materials = await ctx.runQuery(internal.knowledgeAiData.loadAnswerMaterials, {
        knowledgeItemIds: selectedIds,
      });
      materialCount = materials.length;
      if (materials.length === 0) return { status: "no_material", references: [] };

      stage = "generate_draft";
      const generated = await callDeepSeekJson({
        maxTokens: 2200,
        schema: answerDraftSchema,
        systemPrompt: [
          "根据给定的个人知识素材起草求职回答，并输出 JSON。",
          "只能使用素材中明确存在的事实、经历、数字、成果、职责和资格。",
          "禁止编造个人经历或补充未经提供的事实。素材不足时必须在草稿中明确说明不足。",
          "输出格式：{\"draft\":string}。",
        ].join("\n"),
        userPrompt: JSON.stringify({
          question,
          materials: materials.map((item) => ({
            title: item.title,
            content: item.content,
            sourceCompanyName: item.sourceCompanyName ?? null,
          })),
        }),
      });

      return {
        status: "success",
        draft: generated.draft,
        references: materials.map((item) => ({
          knowledgeItemId: item.knowledgeItemId,
          title: item.title,
          sourceCompanyName: item.sourceCompanyName,
        })),
      };
    } catch (error) {
      console.error(
        "[knowledgeAi.generateAnswer]",
        JSON.stringify({
          event: "ai_answer_generation_failed",
          timestamp: new Date().toISOString(),
          stage,
          context: {
            questionLength: question.length,
            candidateCount,
            selectedCount,
            materialCount,
          },
          error: serializeError(error),
        }, null, 2),
      );
      throw new Error("生成失败，请重试");
    }
  },
});

export const refreshQuestionGroupTitle = internalAction({
  args: { groupId: v.id("interviewQuestionGroups") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.knowledgeAiData.getQuestionGroupTitleContext,
      args,
    );
    if (!context) return;
    const title = await generateRepresentativeTitle(
      "这些问题共享同一核心回答。生成一个简洁、中性、不添加新含义的中文代表问题标题，并输出 JSON。",
      context.values,
    );
    await ctx.runMutation(internal.knowledgeAiData.updateQuestionGroupTitle, {
      groupId: args.groupId,
      expectedMemberCount: context.memberCount,
      title,
    });
  },
});

export const refreshWeaknessGroupTitle = internalAction({
  args: { groupId: v.id("weaknessGroups") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.knowledgeAiData.getWeaknessGroupTitleContext,
      args,
    );
    if (!context) return;
    const title = await generateRepresentativeTitle(
      "这些描述属于同一面试弱点。生成一个简洁、中性、不添加新含义的中文弱点标题，并输出 JSON。",
      context.values,
    );
    await ctx.runMutation(internal.knowledgeAiData.updateWeaknessGroupTitle, {
      groupId: args.groupId,
      expectedOccurrenceCount: context.occurrenceCount,
      title,
    });
  },
});

async function generateRepresentativeTitle(instruction: string, values: string[]) {
  const result = await callDeepSeekJson({
    schema: titleSchema,
    systemPrompt: `${instruction}\n输出格式：{\"title\":string}。`,
    userPrompt: JSON.stringify({ values }),
  });
  return result.title;
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof z.ZodError) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      issues: error.issues,
    };
  }

  if (error instanceof DeepSeekError) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    const cause = "cause" in error ? error.cause : undefined;
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(cause === undefined ? {} : { cause: serializeError(cause) }),
    };
  }

  return {
    name: "UnknownThrownValue",
    message: typeof error === "string" ? error : "A non-Error value was thrown",
  };
}
