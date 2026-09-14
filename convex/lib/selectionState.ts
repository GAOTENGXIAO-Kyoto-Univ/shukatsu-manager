import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";

export const selectionStepTypes = [
  "es",
  "web_test",
  "interview",
  "briefing",
  "group_discussion",
  "offer_meeting",
  "other",
] as const;

export type SelectionStepType = (typeof selectionStepTypes)[number];
export type SelectionStepStatus =
  | "waiting_schedule"
  | "preparing"
  | "overdue"
  | "waiting_result"
  | "passed"
  | "failed";
export type ApplicationSelectionStatus = SelectionStepStatus | null;

export const selectionStepTypeValidator = v.union(
  v.literal("es"),
  v.literal("web_test"),
  v.literal("interview"),
  v.literal("briefing"),
  v.literal("group_discussion"),
  v.literal("offer_meeting"),
  v.literal("other"),
);

export const selectionStepResultValidator = v.union(
  v.null(),
  v.literal("passed"),
  v.literal("failed"),
);

export function isSelectionStepType(value: string): value is SelectionStepType {
  return selectionStepTypes.includes(value as SelectionStepType);
}

export function sortSelectionSteps(steps: Doc<"selectionSteps">[]) {
  return [...steps].sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }

    return a._creationTime - b._creationTime;
  });
}

export function deriveSelectionStepStatus(
  step: Pick<Doc<"selectionSteps">, "completed" | "result">,
  event: Pick<Doc<"events">, "datetime"> | null,
  now: number,
): SelectionStepStatus {
  if (step.result === "failed") return "failed";
  if (step.result === "passed") return "passed";
  if (step.completed) return "waiting_result";
  if (!event) return "waiting_schedule";
  return event.datetime > now ? "preparing" : "overdue";
}

export type EventByStep = Map<string, Doc<"events">>;

export function deriveApplicationSelectionState(
  steps: Doc<"selectionSteps">[],
  eventsByStep: EventByStep,
  now: number,
) {
  const orderedSteps = sortSelectionSteps(steps);

  if (orderedSteps.length === 0) {
    return { currentStage: null, currentStatus: null, nextEvent: null };
  }

  const currentStep =
    orderedSteps.find((step) => step.result !== "passed") ?? orderedSteps[orderedSteps.length - 1];
  const currentEvent = eventsByStep.get(currentStep._id.toString()) ?? null;
  const currentStage = toCurrentStage(currentStep);
  const currentStatus = deriveSelectionStepStatus(currentStep, currentEvent, now);

  if (currentStep.result === "failed") {
    return { currentStage, currentStatus, nextEvent: null };
  }

  const candidates = orderedSteps
    .filter((step) => !step.completed && step.result === null)
    .map((step) => ({ step, event: eventsByStep.get(step._id.toString()) }))
    .filter(
      (candidate): candidate is { step: Doc<"selectionSteps">; event: Doc<"events"> } =>
        candidate.event !== undefined,
    );
  const overdueCandidates = candidates.filter(({ event }) => event.datetime <= now);
  const relevantCandidates = overdueCandidates.length > 0 ? overdueCandidates : candidates;
  const selected = [...relevantCandidates].sort((a, b) => {
    if (a.event.datetime !== b.event.datetime) return a.event.datetime - b.event.datetime;
    return a.step.order - b.step.order;
  })[0];

  return {
    currentStage,
    currentStatus,
    nextEvent: selected
      ? {
          eventId: selected.event._id,
          selectionStepId: selected.step._id,
          stepName: selected.step.name,
          stepPresetKey: selected.step.presetKey,
          stepType: selected.step.type,
          stepOrder: selected.step.order,
          timingType: selected.event.timingType,
          datetime: selected.event.datetime,
          hasExplicitTime: selected.event.hasExplicitTime,
          location: selected.event.location,
          meetingUrl: selected.event.meetingUrl,
          note: selected.event.note,
          isOverdue: selected.event.datetime <= now,
        }
      : null,
  };
}

function toCurrentStage(step: Doc<"selectionSteps">) {
  return {
    selectionStepId: step._id,
    name: step.name,
    presetKey: step.presetKey,
    type: step.type,
    order: step.order,
  };
}

export function getLockedBoundaryOrder(steps: Doc<"selectionSteps">[]) {
  const lockedOrders = steps
    .filter((step) => step.completed || step.result !== null)
    .map((step) => step.order);
  return lockedOrders.length === 0 ? null : Math.max(...lockedOrders);
}

type SortableApplicationState = {
  createdAt: number;
  currentStatus: ApplicationSelectionStatus;
  nextEvent: { datetime: number } | null;
};

export function compareApplicationsByAttention(
  a: SortableApplicationState,
  b: SortableApplicationState,
  now: number,
) {
  const aGroup = getApplicationSortGroup(a, now);
  const bGroup = getApplicationSortGroup(b, now);

  if (aGroup !== bGroup) return aGroup - bGroup;

  if ((aGroup === 0 || aGroup === 1) && a.nextEvent && b.nextEvent) {
    const eventTimeDifference = a.nextEvent.datetime - b.nextEvent.datetime;
    if (eventTimeDifference !== 0) return eventTimeDifference;
  }

  return b.createdAt - a.createdAt;
}

function getApplicationSortGroup(application: SortableApplicationState, now: number) {
  if (application.nextEvent) return application.nextEvent.datetime <= now ? 0 : 1;

  switch (application.currentStatus) {
    case "waiting_result":
      return 2;
    case "waiting_schedule":
    case "preparing":
    case "overdue":
      return 3;
    case "passed":
      return 4;
    case null:
      return 5;
    case "failed":
      return 6;
  }
}
