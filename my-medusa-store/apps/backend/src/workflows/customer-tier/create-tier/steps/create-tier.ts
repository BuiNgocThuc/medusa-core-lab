import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { TIER_MODULE, TierModuleService } from "@/src/modules/tier";

const CREATE_TIER_STEP_ID = "create-tier";
type CreateTierStepInput = {
    name: string;
    promo_id: string | null;
};

export const createTierStep = createStep(
    CREATE_TIER_STEP_ID,
    async ({ name, promo_id }: CreateTierStepInput, { container }) => {
        const tierModuleService: TierModuleService = container.resolve(TIER_MODULE);

        const tier = await tierModuleService.createTiers({
            name,
            promo_id: promo_id || null,
        });
        return new StepResponse(tier, tier);
        // Tham số 1: output của step
        // Tham số 2: input của compensation
    },
    async (tier, { container }) => {
        if (!tier) {
            return;
        }

        const tierModuleService: TierModuleService = container.resolve(TIER_MODULE);
        await tierModuleService.deleteTiers(tier.id);
    },
);
