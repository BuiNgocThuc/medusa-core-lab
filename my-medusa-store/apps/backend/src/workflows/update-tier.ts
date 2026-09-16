import { createTierRulesStep, deleteTierRulesStep, updateTierStep } from "@/src/workflows/steps";
import {
    createWorkflow,
    transform,
    when,
    WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";

const UPDATE_TIER_WORKFLOW_ID = "update-tier";

export type UpdateTierWorkflowInput = {
    id: string;
    name: string;
    promo_id?: string | null;
    tier_rules?: Array<{
        min_purchase_value: number;
        currency_code: string;
    }>;
};

export const updateTierWorkflow = createWorkflow(
    UPDATE_TIER_WORKFLOW_ID,
    (input: UpdateTierWorkflowInput) => {
        const { data: tiers } = useQueryGraphStep({
            entity: "tier",
            fields: ["tier_rules.*"],
            filters: {
                id: input.id,
            },
            options: {
                throwIfKeyNotFound: true,
            },
        });
        // Validate promotion if provided
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
            }).config({ name: "retrieve-promotion" });
        });
        const promoId = transform({ input }, ({ input }) => input.promo_id || null);

        // Update the tier
        updateTierStep({
            id: input.id,
            name: input.name,
            promo_id: promoId,
        });

        when({ input }, (data) => {
            return !!data.input.tier_rules?.length;
        }).then(() => {
            const ids = transform(
                {
                    tiers,
                },
                (data) => {
                    return (data.tiers[0].tier_rules?.map((rule) => rule?.id) || []) as string[];
                },
            );
            deleteTierRulesStep({
                ids,
            });
            return createTierRulesStep({
                tier_id: input.id,
                tier_rules: input.tier_rules!,
            });
        });

        // Retrieve the updated tier with rules
        const { data: updatedTiers } = useQueryGraphStep({
            entity: "tier",
            fields: ["*", "tier_rules.*"],
            filters: {
                id: input.id,
            },
        }).config({ name: "updated-tier" });

        return new WorkflowResponse({
            tier: updatedTiers[0],
        });
    },
);
