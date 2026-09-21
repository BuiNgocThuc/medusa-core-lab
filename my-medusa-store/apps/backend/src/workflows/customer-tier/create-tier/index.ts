import {
    createWorkflow,
    transform,
    when,
    WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import {
    createTierRulesStep,
    createTierStep,
    validateTierPromotionOwnershipStep,
} from "./steps";

const CREATE_TIER_WORKFLOW_NAME = "create_tier";
type CreateTierWorkflowInput = {
    name: string;
    promo_id?: string | null;
    tier_rules?: Array<{
        min_purchase_value: number;
        currency_code: string;
    }>;
};

export const createTierWorkflow = createWorkflow(
    CREATE_TIER_WORKFLOW_NAME,

    (input: CreateTierWorkflowInput) => {
        when({ input }, (data) => !!data.input.promo_id).then(() => {
            useQueryGraphStep({
                entity: "promotion",
                fields: ["id"],
                filters: {
                    id: input.promo_id!,
                },
                options: {
                    throwIfKeyNotFound: true,
                },
            });
            validateTierPromotionOwnershipStep({
                promo_id: input.promo_id!,
            });
        });

        const promoId = transform({ input }, ({ input }) => input.promo_id || null);

        // Create Tier
        const tier = createTierStep({
            name: input.name,
            promo_id: promoId,
        });

        // create tier rules if provided
        when({ input }, (data) => !!data.input.tier_rules?.length).then(() => {
            return createTierRulesStep({
                tier_id: tier.id,
                tier_rules: input.tier_rules!,
            });
        });

        // Retrieve the created tier with rules
        const { data: tiers } = useQueryGraphStep({
            entity: "tier",
            fields: ["*", "tier_rules.*"],
            filters: {
                id: tier.id,
            },
        }).config({ name: "retrieve-tier" });

        return new WorkflowResponse({
            tier: tiers[0],
        });
    },
);
