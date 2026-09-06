import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  getOwnedApplication,
  getOwnedSelectionStep,
  listSelectionStepsForApplication,
} from "./lib/authorization";
import {
  deriveSelectionStepStatus,
  getLockedBoundaryOrder,
  isSelectionStepType,
  selectionStepResultValidator,
  selectionStepTypeValidator,
} from "./lib/selectionState";
import {
  deleteInterviewDetailCascade,
  findInterviewDetailBySelectionStep,
} from "./lib/interviews";
import {
  deleteSelectionProgressHistory,
  recordSelectionProgressTransition,
} from "./lib/selectionProgressHistory";

function toStepDto(step: Doc<"selectionSteps">, event: Doc<"events"> | null, now: number) {
  return {
    selectionStepId: step._id,
    applicationId: step.applicationId,
    name: step.name,
    type: step.type,
    order: step.order,
    completed: step.completed,
    result: step.result,
    status: deriveSelectionStepStatus(step, event, now),
    createdAt: step._creationTime,
    updatedAt: step.updatedAt,
  };
}

async function renumberSteps(ctx: MutationCtx, applicationId: Id<"applications">) {
  const steps = await listSelectionStepsForApplication(ctx, applicationId);

  for (const [index, step] of steps.entries()) {
    if (step.order !== index) {
      await ctx.db.patch(step._id, { order: index, updatedAt: Date.now() });
    }
  }
}

export const listByApplication = query({
  args: {
    applicationId: v.id("applications"),
    timeBucket: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owned = await getOwnedApplication(ctx, args.applicationId);

    if (!owned) {
      return [];
    }

    const steps = await listSelectionStepsForApplication(ctx, owned.application._id);
    const now = Date.now();

    return await Promise.all(
      steps.map(async (step) => {
        const event = await ctx.db
          .query("events")
          .withIndex("by_selectionStepId", (q) => q.eq("selectionStepId", step._id))
          .unique();
        return toStepDto(step, event, now);
      }),
    );
  },
});

export const create = mutation({
  args: {
    applicationId: v.id("applications"),
    name: v.string(),
    type: selectionStepTypeValidator,
  },
  handler: async (ctx, args) => {
    const owned = await getOwnedApplication(ctx, args.applicationId);

    if (!owned) {
      throw new Error("应聘记录不存在");
    }

    const name = args.name.trim();

    if (!name) {
      throw new Error("步骤名称不能为空");
    }

    const steps = await listSelectionStepsForApplication(ctx, owned.application._id);
    const lastOrder = steps.length > 0 ? Math.max(...steps.map((step) => step.order)) : -1;

    return await ctx.db.insert("selectionSteps", {
      applicationId: owned.application._id,
      name,
      type: args.type,
      order: lastOrder + 1,
      completed: false,
      result: null,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    selectionStepId: v.id("selectionSteps"),
    name: v.optional(v.string()),
    type: v.optional(selectionStepTypeValidator),
    completed: v.optional(v.boolean()),
    result: v.optional(selectionStepResultValidator),
    confirmDeleteInterviewData: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const owned = await getOwnedSelectionStep(ctx, args.selectionStepId);

    if (!owned) {
      throw new Error("选考步骤不存在");
    }

    const now = Date.now();
    const patch: Partial<Pick<Doc<"selectionSteps">, "name" | "type" | "completed" | "result" | "updatedAt">> = {
      updatedAt: now,
    };

    if (args.name !== undefined) {
      const name = args.name.trim();

      if (!name) {
        throw new Error("步骤名称不能为空");
      }

      patch.name = name;
    }

    if (args.type !== undefined) {
      if (!isSelectionStepType(args.type)) {
        throw new Error("步骤类型不正确");
      }

      if (owned.selectionStep.type === "interview" && args.type !== "interview") {
        const interviewDetail = await findInterviewDetailBySelectionStep(
          ctx,
          owned.selectionStep._id,
        );

        if (interviewDetail && args.confirmDeleteInterviewData !== true) {
          throw new Error("该步骤已有面试复盘，请确认删除面试数据后再修改类型");
        }

        if (interviewDetail) {
          await deleteInterviewDetailCascade(ctx, interviewDetail);
        }
      }

      patch.type = args.type;
    }

    let completed = args.completed ?? owned.selectionStep.completed;
    let result = args.result !== undefined ? args.result : owned.selectionStep.result;

    if (args.completed === false) {
      completed = false;
      result = null;
    } else if (result !== null) {
      completed = true;
    }

    if (args.completed !== undefined || args.result !== undefined) {
      patch.completed = completed;
      patch.result = result;
    }

    await ctx.db.patch(owned.selectionStep._id, patch);
    await recordSelectionProgressTransition(ctx, {
      userId: owned.user._id,
      selectionStepId: owned.selectionStep._id,
      before: owned.selectionStep,
      after: { completed, result },
      now,
    });

    return {
      completedBecameTrue: !owned.selectionStep.completed && completed,
      resultChanged: result !== null && result !== owned.selectionStep.result,
    };
  },
});

export const remove = mutation({
  args: {
    selectionStepId: v.id("selectionSteps"),
  },
  handler: async (ctx, args) => {
    const owned = await getOwnedSelectionStep(ctx, args.selectionStepId);

    if (!owned) {
      throw new Error("选考步骤不存在");
    }

    if (owned.selectionStep.completed || owned.selectionStep.result !== null) {
      throw new Error("已完成的步骤不能直接删除");
    }

    const event = await ctx.db
      .query("events")
      .withIndex("by_selectionStepId", (q) => q.eq("selectionStepId", owned.selectionStep._id))
      .unique();

    if (event) {
      await ctx.db.delete(event._id);
    }

    const interviewDetail = await findInterviewDetailBySelectionStep(
      ctx,
      owned.selectionStep._id,
    );

    if (interviewDetail) {
      await deleteInterviewDetailCascade(ctx, interviewDetail);
    }

    await deleteSelectionProgressHistory(ctx, owned.selectionStep._id);
    await ctx.db.delete(owned.selectionStep._id);
    await renumberSteps(ctx, owned.application._id);
  },
});

export const reorder = mutation({
  args: {
    applicationId: v.id("applications"),
    orderedStepIds: v.array(v.id("selectionSteps")),
  },
  handler: async (ctx, args) => {
    const owned = await getOwnedApplication(ctx, args.applicationId);

    if (!owned) {
      throw new Error("应聘记录不存在");
    }

    const currentSteps = await listSelectionStepsForApplication(ctx, owned.application._id);
    const currentIds = currentSteps.map((step) => step._id);
    const requestedIds = args.orderedStepIds;
    const requestedIdSet = new Set(requestedIds.map((id) => id.toString()));

    if (
      requestedIds.length !== currentIds.length ||
      requestedIdSet.size !== requestedIds.length ||
      currentIds.some((id) => !requestedIdSet.has(id.toString()))
    ) {
      throw new Error("选考步骤顺序不正确");
    }

    const stepById = new Map(currentSteps.map((step) => [step._id.toString(), step]));
    const requestedSteps = requestedIds.map((id) => stepById.get(id.toString()));

    if (requestedSteps.some((step) => !step || step.applicationId !== owned.application._id)) {
      throw new Error("选考步骤顺序不正确");
    }

    const lockedBoundaryOrder = getLockedBoundaryOrder(currentSteps);

    if (lockedBoundaryOrder !== null) {
      const lockedPrefix = currentSteps.filter((step) => step.order <= lockedBoundaryOrder);
      const requestedPrefix = requestedIds.slice(0, lockedPrefix.length);

      if (
        lockedPrefix.some(
          (step, index) => step._id.toString() !== requestedPrefix[index]?.toString(),
        )
      ) {
        throw new Error("已记录的选考历史不能调整顺序");
      }
    }

    for (const [index, selectionStepId] of requestedIds.entries()) {
      await ctx.db.patch(selectionStepId, { order: index, updatedAt: Date.now() });
    }
  },
});
