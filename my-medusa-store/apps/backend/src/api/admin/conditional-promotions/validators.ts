import { z } from "@medusajs/framework/zod"
const clause = z.object({ attribute: z.enum(["product", "category", "collection", "tag", "type"]), values: z.array(z.string()).min(1) })
const matcher = z.object({ mode: z.enum(["all", "any"]), clauses: z.array(clause).min(1) })
const quantity = z.object({ min_quantity: z.number().int().positive(), match: matcher, subset_requirements: z.array(z.object({ min_quantity: z.number().int().positive(), match: matcher })).optional() })
export const ConditionalPromotionSchema = z.object({
  title: z.string().min(1), description: z.string().optional().nullable(), terms: z.string().optional().nullable(), cta_url: z.string().url().optional().nullable(), status: z.enum(["active", "inactive"]), priority: z.number().int().nonnegative(),
  promotion: z.object({ code: z.string().min(1).transform((code) => code.toUpperCase()), percentage: z.number().positive().max(100), target: matcher.refine((value) => value.mode === "all", "Target matcher must use ALL"), max_quantity: z.number().int().positive() }),
  rule_tree: z.object({ version: z.literal(1), operator: z.literal("and"), conditions: z.array(quantity).min(1) }),
  placements: z.object({ category_ids: z.array(z.string()).default([]), collection_ids: z.array(z.string()).default([]) }).optional(),
})
export type ConditionalPromotionInput = z.infer<typeof ConditionalPromotionSchema>
