import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type SelectionState = Pick<Doc<"selectionSteps">, "completed" | "result">;
type ProgressType = Doc<"selectionProgressHistory">["type"];

export function planSelectionProgressTransition(
  before: SelectionState,
  after: SelectionState,
): { invalidateTypes: ProgressType[]; createType: ProgressType | null } {
  const completedChanged = before.completed !== after.completed;
  const resultChanged = before.result !== after.result;
  if (!completedChanged && !resultChanged) {
    return { invalidateTypes: [], createType: null };
  }

  if (before.completed && !after.completed) {
    return {
      invalidateTypes: ["completed", "passed", "failed"],
      createType: null,
    };
  }

  const invalidateTypes: ProgressType[] =
    resultChanged && before.result !== null ? [before.result] : [];
  const createType =
    resultChanged && after.result !== null
      ? after.result
      : completedChanged && after.completed && after.result === null
        ? "completed"
        : null;
  return { invalidateTypes, createType };
}

async function listValidHistory(ctx: MutationCtx, selectionStepId: Id<"selectionSteps">) {
  const history = await ctx.db
    .query("selectionProgressHistory")
    .withIndex("by_selection_step_id", (q) => q.eq("selectionStepId", selectionStepId))
    .collect();
  return history.filter((item) => item.invalidatedAt === undefined);
}

async function invalidateTypes(
  ctx: MutationCtx,
  history: Doc<"selectionProgressHistory">[],
  types: ProgressType[],
  now: number,
) {
  const typeSet = new Set<ProgressType>(types);
  for (const item of history) {
    if (typeSet.has(item.type)) {
      await ctx.db.patch(item._id, { invalidatedAt: now });
    }
  }
}

export async function recordSelectionProgressTransition(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    selectionStepId: Id<"selectionSteps">;
    before: SelectionState;
    after: SelectionState;
    now: number;
  },
) {
  const plan = planSelectionProgressTransition(args.before, args.after);
  if (plan.invalidateTypes.length === 0 && !plan.createType) return;

  if (plan.invalidateTypes.length > 0) {
    const validHistory = await listValidHistory(ctx, args.selectionStepId);
    await invalidateTypes(ctx, validHistory, plan.invalidateTypes, args.now);
  }

  if (plan.createType) {
    await ctx.db.insert("selectionProgressHistory", {
      userId: args.userId,
      selectionStepId: args.selectionStepId,
      type: plan.createType,
      occurredAt: args.now,
      createdAt: args.now,
    });
  }
}

export async function deleteSelectionProgressHistory(
  ctx: MutationCtx,
  selectionStepId: Id<"selectionSteps">,
) {
  const history = await ctx.db
    .query("selectionProgressHistory")
    .withIndex("by_selection_step_id", (q) => q.eq("selectionStepId", selectionStepId))
    .collect();
  for (const item of history) await ctx.db.delete(item._id);
}
