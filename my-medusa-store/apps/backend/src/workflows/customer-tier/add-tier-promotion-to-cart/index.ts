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
    updateCartsStep,
    useQueryGraphStep,
} from "@medusajs/medusa/core-flows";
import { PromotionActions } from "@medusajs/framework/utils";
import {
    buildTierPromotionSyncPlan,
    createTierPromotionSyncMarkerStep,
    validateTierPromotionStep,
} from "./steps";

const ADD_TIER_PROMOTION_TO_CART_WORKFLOW_ID = "add-tier-promotion-to-cart";
export type AddTierPromotionToCartWorkflowInput = {
    cart_id: string;
};

export const addTierPromotionToCartWorkflow = createWorkflow(
    ADD_TIER_PROMOTION_TO_CART_WORKFLOW_ID,
    (input: AddTierPromotionToCartWorkflowInput) => {
        // Get cart with customer, tier, and promotions.
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
                "metadata",
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

        const { data: tiers } = useQueryGraphStep({
            entity: "tier",
            fields: ["id", "promo_id"],
        }).config({ name: "list-tier-promotions" });

        const customer = transform({ carts }, ({ carts }) => {
            return carts[0]?.customer ?? null;
        });

        const validationResult = validateTierPromotionStep({
            customer,
        });

        const syncPlan = transform(
            { carts, tiers, validationResult },
            ({ carts, tiers, validationResult }) => buildTierPromotionSyncPlan({
                promotions: (carts[0].promotions ?? []).filter(
                    (promotion): promotion is NonNullable<typeof promotion> => promotion != null,
                ),
                metadata: carts[0].metadata,
                loyaltyPromotionId: carts[0].metadata?.loyalty_promo_id as string | undefined,
                desiredPromotion:
                    validationResult.promotion_id && validationResult.promotion_code
                        ? {
                            id: validationResult.promotion_id,
                            code: validationResult.promotion_code,
                        }
                        : null,
                tierPromotions: tiers,
            }),
        );

        when({ syncPlan }, ({ syncPlan }) => syncPlan.promotions_changed).then(() => {
            const markerInput = transform({ syncPlan, input }, ({ syncPlan, input }) => ({
                cart_id: input.cart_id,
                promo_codes: syncPlan.promo_codes,
            }));
            const marker = createTierPromotionSyncMarkerStep(markerInput);
            const promotionInput = transform({ syncPlan, input, marker }, ({ syncPlan, input, marker }) => ({
                cart_id: input.cart_id,
                promo_codes: syncPlan.promo_codes,
                action: PromotionActions.REPLACE,
                tier_promotion_sync_marker: marker,
            }));

            return updateCartPromotionsWorkflow.runAsStep({
                input: promotionInput as any,
            });
        });

        when({ syncPlan }, ({ syncPlan }) => syncPlan.metadata_changed).then(() => {
            const updateInput = transform({ carts, syncPlan, input }, ({ carts, syncPlan, input }) => [{
                id: input.cart_id,
                metadata: {
                    ...(carts[0].metadata ?? {}),
                    tier_promotion_ids: syncPlan.tier_promotion_ids,
                },
            }]);
            return updateCartsStep(updateInput);
        });

        releaseLockStep({
            key: input.cart_id,
        });

        return new WorkflowResponse(void 0);
    },
);
