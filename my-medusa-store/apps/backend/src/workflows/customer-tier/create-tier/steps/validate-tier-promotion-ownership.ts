import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";
import { TIER_MODULE, TierModuleService } from "@/src/modules/tier";

type ValidateTierPromotionOwnershipInput = {
    promo_id: string;
    tier_id?: string;
};

// prevent Admin set up 2 tiers owns 1 promotion
export const validateTierPromotionOwnershipStep = createStep(
    "validate-tier-promotion-ownership",
    async ({ promo_id, tier_id }: ValidateTierPromotionOwnershipInput, { container }) => {
        const tierModuleService: TierModuleService = container.resolve(TIER_MODULE);
        const tiers = await tierModuleService.listTiers({ promo_id });
        const conflictingTier = tiers.find((tier) => tier.id !== tier_id);

        if (conflictingTier) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "A promotion can only be assigned to one customer tier",
            );
        }

        return new StepResponse(void 0);
    },
);
