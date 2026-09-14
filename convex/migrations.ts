import { internalMutation } from "./_generated/server";
import { getBackfillPresetKey } from "./lib/selectionPresets";

export const backfillSelectionStepPresetKeys = internalMutation({
  args: {},
  handler: async (ctx) => {
    const steps = await ctx.db.query("selectionSteps").collect();
    let updated = 0;
    let alreadySet = 0;
    let unmatched = 0;

    for (const step of steps) {
      if (step.presetKey) {
        alreadySet += 1;
        continue;
      }

      const presetKey = getBackfillPresetKey(step);
      if (!presetKey) {
        unmatched += 1;
        continue;
      }

      await ctx.db.patch(step._id, { presetKey });
      updated += 1;
    }

    return { total: steps.length, updated, alreadySet, unmatched };
  },
});
