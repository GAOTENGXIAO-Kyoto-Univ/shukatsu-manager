import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  getOwnedApplication,
  listSelectionStepsForApplication,
} from "./lib/authorization";
import { createStepsInEmptyApplication } from "./lib/selectionProcessBatch";
import {
  type SelectionProcessTemplateKey,
  validateCopyStepSelection,
  validateTemplatePresetSelection,
} from "./lib/selectionProcessTemplates";
import {
  getSelectionStepPresetDefinition,
  selectionStepPresetKeyValidator,
} from "./lib/selectionPresets";

const selectionProcessTemplateKeyValidator = v.union(
  v.literal("standard"),
  v.literal("coding"),
  v.literal("briefing"),
  v.literal("group_discussion"),
);

export const listCopySources = query({
  args: { targetApplicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const target = await getOwnedApplication(ctx, args.targetApplicationId);

    if (!target) {
      throw new Error("SELECTION_PROCESS_UNAVAILABLE");
    }

    const companies = await ctx.db
      .query("companies")
      .withIndex("by_userId", (q) => q.eq("userId", target.user._id))
      .collect();

    const sourceCompanies = await Promise.all(
      companies.map(async (company) => {
        const applications = await ctx.db
          .query("applications")
          .withIndex("by_companyId", (q) => q.eq("companyId", company._id))
          .collect();
        const eligibleApplications = (
          await Promise.all(
            applications
              .filter((application) => application._id !== target.application._id)
              .map(async (application) => ({
                application,
                stepCount: (
                  await listSelectionStepsForApplication(ctx, application._id)
                ).length,
              })),
          )
        )
          .filter(({ stepCount }) => stepCount > 0)
          .map(({ application, stepCount }) => ({
            applicationId: application._id,
            jobTitle: application.jobTitle,
            stepCount,
          }))
          .sort((a, b) => a.jobTitle.localeCompare(b.jobTitle));

        return {
          companyId: company._id,
          name: company.name,
          applications: eligibleApplications,
        };
      }),
    );

    return sourceCompanies.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const getCopyPreview = query({
  args: { sourceApplicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const source = await getOwnedApplication(ctx, args.sourceApplicationId);

    if (!source) {
      return null;
    }

    const steps = await listSelectionStepsForApplication(ctx, source.application._id);

    return steps.map((step) => ({
      selectionStepId: step._id,
      presetKey: step.presetKey,
      name: step.name,
      type: step.type,
      order: step.order,
    }));
  },
});

export const createFromTemplate = mutation({
  args: {
    targetApplicationId: v.id("applications"),
    templateKey: selectionProcessTemplateKeyValidator,
    orderedTemplateStepKeys: v.array(selectionStepPresetKeyValidator),
  },
  handler: async (ctx, args) => {
    const orderedPresetKeys = validateTemplatePresetSelection(
      args.templateKey as SelectionProcessTemplateKey,
      args.orderedTemplateStepKeys,
    );
    const drafts = orderedPresetKeys.map((presetKey) => ({
      ...getSelectionStepPresetDefinition(presetKey),
      presetKey,
    }));

    return await createStepsInEmptyApplication(
      ctx,
      args.targetApplicationId,
      drafts,
    );
  },
});

export const copyFromApplication = mutation({
  args: {
    targetApplicationId: v.id("applications"),
    sourceApplicationId: v.id("applications"),
    expectedSourceStepIds: v.array(v.id("selectionSteps")),
    orderedSourceStepIds: v.array(v.id("selectionSteps")),
  },
  handler: async (ctx, args) => {
    const target = await getOwnedApplication(ctx, args.targetApplicationId);

    if (!target || args.targetApplicationId === args.sourceApplicationId) {
      throw new Error("SELECTION_PROCESS_UNAVAILABLE");
    }

    const source = await getOwnedApplication(ctx, args.sourceApplicationId);

    if (!source) {
      throw new Error("SELECTION_PROCESS_UNAVAILABLE");
    }

    const sourceSteps = await listSelectionStepsForApplication(
      ctx,
      source.application._id,
    );
    const requestedIds = validateCopyStepSelection(
      sourceSteps.map((step) => step._id.toString()),
      args.expectedSourceStepIds.map((selectionStepId) => selectionStepId.toString()),
      args.orderedSourceStepIds.map((selectionStepId) => selectionStepId.toString()),
    );
    const sourceStepById = new Map(
      sourceSteps.map((step) => [step._id.toString(), step]),
    );

    const drafts = requestedIds.map((selectionStepId) => {
      const step = sourceStepById.get(selectionStepId);

      if (!step) {
        throw new Error("SELECTION_PROCESS_SOURCE_CHANGED");
      }

      return {
        name: step.name,
        ...(step.presetKey ? { presetKey: step.presetKey } : {}),
        type: step.type,
      };
    });

    return await createStepsInEmptyApplication(
      ctx,
      target.application._id,
      drafts,
    );
  },
});
