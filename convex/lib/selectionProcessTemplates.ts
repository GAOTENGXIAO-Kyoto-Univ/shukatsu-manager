import type { SelectionStepPresetKey } from "./selectionPresets";

export const selectionProcessTemplateKeys = [
  "standard",
  "coding",
  "briefing",
  "group_discussion",
] as const;

export type SelectionProcessTemplateKey =
  (typeof selectionProcessTemplateKeys)[number];

export const selectionProcessTemplates: readonly {
  key: SelectionProcessTemplateKey;
  presetKeys: readonly SelectionStepPresetKey[];
}[] = [
  {
    key: "standard",
    presetKeys: [
      "es",
      "web_test",
      "first_interview",
      "second_interview",
      "final_interview",
    ],
  },
  {
    key: "coding",
    presetKeys: [
      "es",
      "coding_test",
      "first_interview",
      "second_interview",
      "final_interview",
    ],
  },
  {
    key: "briefing",
    presetKeys: [
      "briefing",
      "es",
      "web_test",
      "first_interview",
      "second_interview",
      "final_interview",
    ],
  },
  {
    key: "group_discussion",
    presetKeys: [
      "es",
      "web_test",
      "group_discussion",
      "first_interview",
      "second_interview",
      "final_interview",
    ],
  },
];

export function getSelectionProcessTemplate(key: SelectionProcessTemplateKey) {
  return selectionProcessTemplates.find((template) => template.key === key) ?? null;
}

export function validateTemplatePresetSelection(
  templateKey: SelectionProcessTemplateKey,
  orderedPresetKeys: readonly SelectionStepPresetKey[],
) {
  const template = getSelectionProcessTemplate(templateKey);

  if (!template) {
    throw new Error("SELECTION_PROCESS_TEMPLATE_INVALID");
  }

  const requestedKeySet = new Set(orderedPresetKeys);
  const allowedKeySet = new Set(template.presetKeys);

  if (
    orderedPresetKeys.length === 0 ||
    requestedKeySet.size !== orderedPresetKeys.length ||
    orderedPresetKeys.some((presetKey) => !allowedKeySet.has(presetKey))
  ) {
    throw new Error("SELECTION_PROCESS_TEMPLATE_STEPS_INVALID");
  }

  return [...orderedPresetKeys];
}

export function validateCopyStepSelection(
  sourceStepIds: readonly string[],
  expectedSourceStepIds: readonly string[],
  orderedSourceStepIds: readonly string[],
) {
  const expectedIdSet = new Set(expectedSourceStepIds);
  const requestedIdSet = new Set(orderedSourceStepIds);

  if (
    sourceStepIds.length === 0 ||
    expectedSourceStepIds.length !== sourceStepIds.length ||
    expectedIdSet.size !== expectedSourceStepIds.length ||
    sourceStepIds.some(
      (selectionStepId, index) => selectionStepId !== expectedSourceStepIds[index],
    ) ||
    orderedSourceStepIds.length === 0 ||
    requestedIdSet.size !== orderedSourceStepIds.length ||
    orderedSourceStepIds.some((selectionStepId) => !expectedIdSet.has(selectionStepId))
  ) {
    throw new Error("SELECTION_PROCESS_SOURCE_CHANGED");
  }

  return [...orderedSourceStepIds];
}
