import {
    createWorkflow,
    WorkflowResponse,
    transform,
    when,
} from "@medusajs/framework/workflows-sdk";
import {
    acquireLockStep,
    releaseLockStep,
    updateCartPromotionsWorkflow,
    useQueryGraphStep,
} from "@medusajs/medusa/core-flows";
import { PromotionActions } from "@medusajs/framework/utils";
import { validateTierPromotionStep } from "./steps";

const ADD_TIER_PROMOTION_TO_CART_WORKFLOW_ID = "add-tier-promotion-to-cart";
export type AddTierPromotionToCartWorkflowInput = {
    cart_id: string;
};

export const addTierPromotionToCartWorkflow = createWorkflow(
    ADD_TIER_PROMOTION_TO_CART_WORKFLOW_ID,
    (input: AddTierPromotionToCartWorkflowInput) => {
        // Get cart with customer, tier, and promotions
        const { data: carts } = useQueryGraphStep({
            entity: "cart",
            fields: [
                "id",
                "customer.id",
                "customer.has_account",
                "customer.tier.*",
                "customer.tier.promotion.id",
                "customer.tier.promotion.code",
                "customer.tier.promotion.status",
                "promotions.*",
                "promotions.code",
            ],
            filters: {
                id: input.cart_id,
            },
            options: {
                throwIfKeyNotFound: true,
            },
        });

        acquireLockStep({
            key: input.cart_id,
            timeout: 2,
            ttl: 10,
        });

        const customer = transform({ carts }, ({ carts }) => {
            return carts[0]?.customer ?? null;
        });

        const validationResult = validateTierPromotionStep({
            customer,
        });

        // Add promotion to cart if valid and not already applied
        when({ validationResult, carts }, ({ validationResult, carts }) => {
            const promotionCode = validationResult.promotion_code;

            if (!promotionCode) {
                return false;
            }

            const isAlreadyApplied =
                carts[0].promotions?.some((promotion) => promotion?.code === promotionCode) ??
                false;

            return !isAlreadyApplied;
        }).then(() => {
            const promoCodes = transform({ validationResult }, ({ validationResult }) => [
                validationResult?.promotion_code!,
            ]);

            return updateCartPromotionsWorkflow.runAsStep({
                input: {
                    cart_id: input.cart_id,
                    promo_codes: promoCodes,
                    action: PromotionActions.ADD,
                },
            });
        });

        releaseLockStep({
            key: input.cart_id,
        });

        return new WorkflowResponse(void 0);
    },
);
