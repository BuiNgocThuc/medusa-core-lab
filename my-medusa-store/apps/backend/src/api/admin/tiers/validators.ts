import { z } from "@medusajs/framework/zod";

export const CreateTierSchema = z.object({
    name: z.string(),
    promo_id: z.string().nullable(),
    tier_rules: z.array(
        z.object({
            min_purchase_value: z.number(),
            currency_code: z.string(),
        }),
    ),
});

export type CreateTierInput = z.infer<typeof CreateTierSchema>;
