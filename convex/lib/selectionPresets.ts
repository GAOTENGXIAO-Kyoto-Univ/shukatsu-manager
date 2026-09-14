import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";

export const selectionStepPresetKeys = [
  "briefing",
  "es",
  "web_test",
  "group_discussion",
  "first_interview",
  "second_interview",
  "third_interview",
  "final_interview",
  "offer_meeting",
] as const;

export type SelectionStepPresetKey = (typeof selectionStepPresetKeys)[number];

export const selectionStepPresetKeyValidator = v.union(
  v.literal("briefing"),
  v.literal("es"),
  v.literal("web_test"),
  v.literal("group_discussion"),
  v.literal("first_interview"),
  v.literal("second_interview"),
  v.literal("third_interview"),
  v.literal("final_interview"),
  v.literal("offer_meeting"),
);

const presetTypes: Record<SelectionStepPresetKey, Doc<"selectionSteps">["type"]> = {
  briefing: "briefing",
  es: "es",
  web_test: "web_test",
  group_discussion: "group_discussion",
  first_interview: "interview",
  second_interview: "interview",
  third_interview: "interview",
  final_interview: "interview",
  offer_meeting: "offer_meeting",
};

const historicalPresetMatches: Record<
  string,
  { presetKey: SelectionStepPresetKey; type: Doc<"selectionSteps">["type"] }
> = {
  "说明会": { presetKey: "briefing", type: "briefing" },
  ES: { presetKey: "es", type: "es" },
  "Web Test": { presetKey: "web_test", type: "web_test" },
  GD: { presetKey: "group_discussion", type: "group_discussion" },
  "一面": { presetKey: "first_interview", type: "interview" },
  "二面": { presetKey: "second_interview", type: "interview" },
  "三面": { presetKey: "third_interview", type: "interview" },
  "最终面试": { presetKey: "final_interview", type: "interview" },
  "Offer面談": { presetKey: "offer_meeting", type: "offer_meeting" },
};

export function isPresetTypeCompatible(
  presetKey: SelectionStepPresetKey,
  type: Doc<"selectionSteps">["type"],
) {
  return presetTypes[presetKey] === type;
}

export function getHistoricalPresetKey(
  name: string,
  type: Doc<"selectionSteps">["type"],
) {
  const match = historicalPresetMatches[name];
  return match?.type === type ? match.presetKey : null;
}

export function shouldClearSelectionStepPreset(
  current: Pick<Doc<"selectionSteps">, "name" | "type">,
  update: { name?: string; type?: Doc<"selectionSteps">["type"] },
) {
  return (update.name !== undefined && update.name.trim() !== current.name) ||
    (update.type !== undefined && update.type !== current.type);
}

export function getBackfillPresetKey(
  step: Pick<Doc<"selectionSteps">, "name" | "type" | "presetKey">,
) {
  return step.presetKey ? null : getHistoricalPresetKey(step.name, step.type);
}
