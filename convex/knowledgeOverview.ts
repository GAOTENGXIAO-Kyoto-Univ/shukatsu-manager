import { query } from "./_generated/server";
import {
  listQuestionGroupAggregates,
  listWeaknessGroupAggregates,
} from "./lib/knowledgeAggregates";
import { getCurrentUserOrThrow } from "./users";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const [questionGroups, weaknessGroups, knowledgeItems] = await Promise.all([
      listQuestionGroupAggregates(ctx, user._id),
      listWeaknessGroupAggregates(ctx, user._id),
      ctx.db
        .query("knowledgeItems")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
    ]);

    const topFrequentQuestions = questionGroups
      .filter((group) => group.questionCount >= 2)
      .sort((left, right) =>
        right.questionCount - left.questionCount ||
        right.latestOccurrence - left.latestOccurrence,
      )
      .slice(0, 5)
      .map(({ history: _history, ...summary }) => summary);
    const topWeakAnswers = questionGroups
      .filter((group) => group.poorCount >= 2)
      .sort((left, right) =>
        right.poorCount - left.poorCount ||
        right.poorRate - left.poorRate ||
        right.latestPoorOccurrence - left.latestPoorOccurrence,
      )
      .slice(0, 3)
      .map(({ history: _history, ...summary }) => summary);
    const topWeaknesses = weaknessGroups
      .sort((left, right) =>
        right.interviewCount - left.interviewCount ||
        right.latestOccurrence - left.latestOccurrence,
      )
      .slice(0, 3)
      .map(({ history: _history, ...summary }) => summary);
    const sortedKnowledge = knowledgeItems.sort((left, right) => right.updatedAt - left.updatedAt);

    return {
      topWeaknesses,
      topFrequentQuestions,
      topWeakAnswers,
      recentKnowledgeItems: sortedKnowledge
        .filter((item) => item.category === "qa" || item.category === "material")
        .slice(0, 4)
        .map((item) => ({
          knowledgeItemId: item._id,
          category: item.category,
          title: item.title,
          content: item.content,
          updatedAt: item.updatedAt,
        })),
      recentReverseQuestions: sortedKnowledge
        .filter((item) => item.category === "reverse_question")
        .slice(0, 3)
        .map((item) => ({
          knowledgeItemId: item._id,
          title: item.title,
          content: item.content,
          updatedAt: item.updatedAt,
        })),
    };
  },
});
