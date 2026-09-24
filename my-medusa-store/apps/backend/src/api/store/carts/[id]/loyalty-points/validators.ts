import { z } from "@medusajs/framework/zod"

export const RedeemLoyaltyPointsSchema = z.object({
    points: z.number().int().positive(),
})

export type RedeemLoyaltyPointsInput = z.infer<typeof RedeemLoyaltyPointsSchema>
