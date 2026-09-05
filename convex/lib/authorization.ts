import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getCurrentUserOrThrow } from "../users";
import { sortSelectionSteps } from "./selectionState";

export type AuthorizedCtx = QueryCtx | MutationCtx;

export async function getOwnedApplication(
  ctx: AuthorizedCtx,
  applicationId: Id<"applications">,
) {
  const user = await getCurrentUserOrThrow(ctx);
  const application = await ctx.db.get(applicationId);

  if (!application) {
    return null;
  }

  const company = await ctx.db.get(application.companyId);

  if (!company || company.userId !== user._id) {
    return null;
  }

  return { user, application, company };
}

export async function getOwnedCompany(ctx: AuthorizedCtx, companyId: Id<"companies">) {
  const user = await getCurrentUserOrThrow(ctx);
  const company = await ctx.db.get(companyId);

  if (!company || company.userId !== user._id) {
    return null;
  }

  return { user, company };
}

export async function listSelectionStepsForApplication(
  ctx: AuthorizedCtx,
  applicationId: Id<"applications">,
) {
  const steps = await ctx.db
    .query("selectionSteps")
    .withIndex("by_applicationId_order", (q) => q.eq("applicationId", applicationId))
    .collect();

  return sortSelectionSteps(steps);
}

export async function getOwnedSelectionStep(
  ctx: AuthorizedCtx,
  selectionStepId: Id<"selectionSteps">,
): Promise<
  | {
      user: Doc<"users">;
      company: Doc<"companies">;
      application: Doc<"applications">;
      selectionStep: Doc<"selectionSteps">;
    }
  | null
> {
  const user = await getCurrentUserOrThrow(ctx);
  const selectionStep = await ctx.db.get(selectionStepId);

  if (!selectionStep) {
    return null;
  }

  const application = await ctx.db.get(selectionStep.applicationId);

  if (!application) {
    return null;
  }

  const company = await ctx.db.get(application.companyId);

  if (!company || company.userId !== user._id) {
    return null;
  }

  return { user, company, application, selectionStep };
}

export async function getOwnedInterviewDetail(
  ctx: AuthorizedCtx,
  interviewDetailId: Id<"interviewDetails">,
) {
  const user = await getCurrentUserOrThrow(ctx);
  const interviewDetail = await ctx.db.get(interviewDetailId);

  if (!interviewDetail) {
    return null;
  }

  const selectionStep = await ctx.db.get(interviewDetail.selectionStepId);

  if (!selectionStep) {
    return null;
  }

  const application = await ctx.db.get(selectionStep.applicationId);

  if (!application) {
    return null;
  }

  const company = await ctx.db.get(application.companyId);

  if (!company || company.userId !== user._id) {
    return null;
  }

  return { user, company, application, selectionStep, interviewDetail };
}

export async function getOwnedInterviewQuestion(
  ctx: AuthorizedCtx,
  interviewQuestionId: Id<"interviewQuestions">,
) {
  const user = await getCurrentUserOrThrow(ctx);
  const interviewQuestion = await ctx.db.get(interviewQuestionId);

  if (!interviewQuestion) {
    return null;
  }

  const interviewDetail = await ctx.db.get(interviewQuestion.interviewDetailId);

  if (!interviewDetail) {
    return null;
  }

  const selectionStep = await ctx.db.get(interviewDetail.selectionStepId);

  if (!selectionStep) {
    return null;
  }

  const application = await ctx.db.get(selectionStep.applicationId);

  if (!application) {
    return null;
  }

  const company = await ctx.db.get(application.companyId);

  if (!company || company.userId !== user._id) {
    return null;
  }

  return {
    user,
    company,
    application,
    selectionStep,
    interviewDetail,
    interviewQuestion,
  };
}
