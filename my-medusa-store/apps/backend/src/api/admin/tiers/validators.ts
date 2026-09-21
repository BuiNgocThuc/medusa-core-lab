import { z } from "@medusajs/framework/zod";

export const CreateTierSchema = z.object({
    name: z.string().trim().min(1),
    promo_id: z.string().nullable(),
    tier_rules: z.array(
        z.object({
            min_purchase_value: z.number().finite().nonnegative(),
            currency_code: z.string().trim().length(3).toLowerCase(),
        }),
    ).min(1),
});

export type CreateTierInput = z.infer<typeof CreateTierSchema>;
