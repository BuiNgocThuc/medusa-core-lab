import { TIER_MODULE, TierModuleService } from "@/src/modules/tier";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

const UPDATE_TIER_STEP_ID = "update-tier";

export type UpdateTierStepInput = {
    id: string;
    name: string;
    promo_id: string | null;
};

export const updateTierStep = createStep(
    UPDATE_TIER_STEP_ID,
    async (input: UpdateTierStepInput, { container }) => {
        const tierModuleService: TierModuleService = container.resolve(TIER_MODULE);

        const originalTier = await tierModuleService.retrieveTier(input.id);

        const tier = await tierModuleService.updateTiers(input);

        return new StepResponse(tier, originalTier);
    },
    async (originalInput, { container }) => {
        if (!originalInput) {
            return;
        }

        const tierModuleService: TierModuleService = container.resolve(TIER_MODULE);

        await tierModuleService.updateTiers({
            id: originalInput.id,
            name: originalInput.name,
            promo_id: originalInput.promo_id,
        });
    },
);
