import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getOwnedApplication, listSelectionStepsForApplication } from "./authorization";
import {
  isPresetTypeCompatible,
  type SelectionStepPresetKey,
} from "./selectionPresets";

export type SelectionProcessStepDraft = {
  name: string;
  presetKey?: SelectionStepPresetKey;
  type: Doc<"selectionSteps">["type"];
};

export async function createStepsInEmptyApplication(
  ctx: MutationCtx,
  applicationId: Id<"applications">,
  drafts: readonly SelectionProcessStepDraft[],
) {
  const owned = await getOwnedApplication(ctx, applicationId);

  if (!owned) {
    throw new Error("SELECTION_PROCESS_UNAVAILABLE");
  }

  const existingSteps = await listSelectionStepsForApplication(
    ctx,
    owned.application._id,
  );

  if (existingSteps.length > 0) {
    throw new Error("SELECTION_PROCESS_TARGET_NOT_EMPTY");
  }

  if (drafts.length === 0) {
    throw new Error("SELECTION_PROCESS_STEPS_REQUIRED");
  }

  for (const draft of drafts) {
    if (!draft.name.trim()) {
      throw new Error("SELECTION_PROCESS_STEP_INVALID");
    }

    if (draft.presetKey && !isPresetTypeCompatible(draft.presetKey, draft.type)) {
      throw new Error("SELECTION_PROCESS_STEP_INVALID");
    }
  }

  const now = Date.now();
  const selectionStepIds: Id<"selectionSteps">[] = [];

  for (const [order, draft] of drafts.entries()) {
    selectionStepIds.push(
      await ctx.db.insert("selectionSteps", {
        applicationId: owned.application._id,
        name: draft.name,
        ...(draft.presetKey ? { presetKey: draft.presetKey } : {}),
        type: draft.type,
        order,
        completed: false,
        result: null,
        updatedAt: now,
      }),
    );
  }

  return selectionStepIds;
}
