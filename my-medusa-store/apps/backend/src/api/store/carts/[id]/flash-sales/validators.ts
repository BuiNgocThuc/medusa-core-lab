import { z } from "@medusajs/framework/zod"

export const ClaimFlashSaleSchema = z.object({ code: z.string().min(1).transform((code) => code.toUpperCase()) })
export type ClaimFlashSaleInput = z.infer<typeof ClaimFlashSaleSchema>
