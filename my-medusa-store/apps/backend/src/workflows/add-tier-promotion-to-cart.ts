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
import { validateTierPromotionStep } from "@/src/workflows/steps";

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
        const tierPromotionInput = transform({ carts }, ({ carts }) => {
            const customer = carts[0]?.customer
            const tier = customer?.tier
            const promotion = tier?.promotion

            return {
                has_account: customer?.has_account ?? false,
                tier: tier
                    ? {
                          promo_id: tier.promo_id || null,
                          promotion: promotion
                              ? {
                                    id: promotion.id,
                                    code: promotion.code || null,
                                    status: promotion.status || null,
                                }
                              : null,
                      }
                    : null,
            }
        })

        const validationResult = when({ carts }, (data) => !!data.carts[0].customer).then(() => {
            return validateTierPromotionStep({
                customer: tierPromotionInput,
            });
        });

        // Add promotion to cart if valid and not already applied
        when({ validationResult, carts }, (data) => {
            if (!data.validationResult?.promotion_code) {
                return false;
            }

            const appliedPromotionCodes =
                data.carts[0].promotions?.map((promo: any) => promo.code) || [];

            return (
                data.validationResult?.promotion_code !== null &&
                !appliedPromotionCodes.includes(data.validationResult?.promotion_code!)
            );
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
