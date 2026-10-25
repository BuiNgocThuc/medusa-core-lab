import { z } from "@medusajs/framework/zod";

export const NextTierSchema = z.object({
    region_id: z.string(),
});

export type NextTierInput = z.infer<typeof NextTierSchema>;
