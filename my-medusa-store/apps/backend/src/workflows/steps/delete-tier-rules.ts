import { TIER_MODULE, TierModuleService } from "@/src/modules/tier";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

const DELETE_TIER_RULES_ID = "delete-tier-rules";
export type DeleteTierRulesStepInput = {
    ids: string[];
};

export const deleteTierRulesStep = createStep(
    DELETE_TIER_RULES_ID,
    async (input: DeleteTierRulesStepInput, { container }) => {
        const tierModuleService: TierModuleService = container.resolve(TIER_MODULE);

        // Get existing rules
        const existingRules = await tierModuleService.listTierRules({
            id: input.ids,
        });

        // Delete all rules
        await tierModuleService.deleteTierRules(input.ids);

        return new StepResponse(void 0, existingRules);
    },
    async (compensationData, { container }) => {
        if (!compensationData?.length) {
            return;
        }

        const tierModuleService: TierModuleService = container.resolve(TIER_MODULE);
        // Restore deleted rules
        await tierModuleService.createTierRules(
            compensationData.map((rule) => ({
                tier_id: rule.tier_id,
                min_purchase_value: rule.min_purchase_value,
                currency_code: rule.currency_code,
            })),
        );
    },
);
