import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

const VALIDATE_TIER_PROMOTION_STEP_ID = "validate-tier-promotion";
export type ValidateTierPromotionStepInput = {
    customer: {
        has_account: boolean;
        tier?: {
            promo_id?: string | null;
            promotion?: {
                id?: string;
                code?: string | null;
                status?: string | null;
            } | null;
        } | null;
    } | null;
};

// validate whether customer owns tier promo
export const validateTierPromotionStep = createStep(
    VALIDATE_TIER_PROMOTION_STEP_ID,
    async (input: ValidateTierPromotionStepInput) => {
        const customer = input.customer;

        if (!customer?.has_account) {
            return new StepResponse({
                promotion_code: null,
            });
        }

        const tier = customer.tier;
        const promotion = tier?.promotion;

        if (!tier?.promo_id || !promotion || promotion.status !== "active") {
            return new StepResponse({
                promotion_code: null,
            });
        }

        return new StepResponse({
            promotion_code: promotion.code ?? null,
        });
    },
);
