import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { TIER_MODULE, TierModuleService } from "@/src/modules/tier";

const CREATE_TIER_RULES_STEP_ID = "create-tier-rules";
type CreateTierRuleStepInput = {
    tier_id: string;
    tier_rules: Array<{
        min_purchase_value: number;
        currency_code: string;
    }>;
};

export const createTierRulesStep = createStep(
    CREATE_TIER_RULES_STEP_ID,
    async (input: CreateTierRuleStepInput, { container }) => {
        const tierModuleService: TierModuleService = container.resolve(TIER_MODULE);

        const createdRules = await tierModuleService.createTierRules(
            input.tier_rules.map((rule) => ({
                tier_id: input.tier_id,
                min_purchase_value: rule.min_purchase_value,
                currency_code: rule.currency_code,
            })),
        );

        return new StepResponse(createdRules, createdRules);
    },
    async (createdRules, { container }) => {
        if (!createdRules?.length) {
            return;
        }

        const tierModuleService: TierModuleService = container.resolve(TIER_MODULE);
        await tierModuleService.deleteTierRules(createdRules.map((rule) => rule.id));
    },
);
