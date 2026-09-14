import { v } from "convex/values";

export const appLocaleValidator = v.union(
  v.literal("zh-CN"),
  v.literal("ja-JP"),
  v.literal("en-US"),
);

