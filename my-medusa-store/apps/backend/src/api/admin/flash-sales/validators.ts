import { z } from "@medusajs/framework/zod"

const weekday = z.number().int().min(0).max(6)
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export const FlashSaleSchema = z.object({
  timezone: z.string().min(1).default("Asia/Ho_Chi_Minh"),
  start_time: time,
  end_time: time,
  weekdays: z.array(weekday).min(1),
  max_discount_amount: z.number().positive(),
  campaign: z.object({
    name: z.string().min(1),
    campaign_identifier: z.string().min(1).transform((value) => value.toUpperCase()),
    starts_at: z.coerce.date(),
    ends_at: z.coerce.date(),
    budget_type: z.enum(["spend", "usage"]),
    budget_limit: z.number().positive(),
    usage_limit: z.number().int().positive(),
  }).refine((campaign) => campaign.starts_at < campaign.ends_at, "Campaign must end after it starts"),
  promotion: z.object({
    code: z.string().min(1).transform((value) => value.toUpperCase()),
    percentage: z.number().positive().max(100),
  }),
}).refine((value) => value.start_time < value.end_time, "Flash Sale windows must end on the same day")

export type FlashSaleInput = z.infer<typeof FlashSaleSchema>
