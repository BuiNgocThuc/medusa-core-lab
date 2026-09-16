import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { TIER_MODULE, TierModuleService } from "@/src/modules/tier";

const DETERMINE_TIER_STEP_ID = "determine-tier";
export type DetermineTierStepInput = {
    currency_code: string;
    purchase_value: number;
};

export const determineTierStep = createStep(
    DETERMINE_TIER_STEP_ID,
    async (input: DetermineTierStepInput, { container }) => {
        const tierModuleService: TierModuleService = container.resolve(TIER_MODULE);

        const qualifyingTier = await tierModuleService.calculateQualifyingTier(
            input.currency_code,
            input.purchase_value,
        );

        return new StepResponse(qualifyingTier);
    },
);
