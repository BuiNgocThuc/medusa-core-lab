import {
    createWorkflow,
    transform,
    when,
    WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { updateCartPromotionsStep, useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { FIRST_PURCHASE_PROMOTION_CODE } from "@/src/constant";
import { PromotionActions } from "@medusajs/framework/utils";

const APPLY_FIRST_PURCHASE_PROMO_WORKFLOW_ID = "apply-first-purchase-promo";

type ApplyFirstPurchasePromoWorkflowInput = {
    cart_id: string;
};

export const applyFirstPurchasePromoWorkflow = createWorkflow(
    APPLY_FIRST_PURCHASE_PROMO_WORKFLOW_ID,

    ({ cart_id }: ApplyFirstPurchasePromoWorkflowInput) => {
        const { data: carts } = useQueryGraphStep({
            entity: "cart",
            fields: ["promotions.*", "customer.*", "customer.orders.id"],
            filters: {
                id: cart_id,
            },
        });

        const { data: promotions } = useQueryGraphStep({
            entity: "promotion",
            fields: ["id", "code", "status"],
            filters: {
                code: FIRST_PURCHASE_PROMOTION_CODE,
            },
        }).config({ name: "retrieve-promotions" });

        when(
            {
                carts,
                promotions,
            },
            (data) => {
                return (
                    data.promotions.length > 0 &&
                    data.promotions[0].status === "active" &&
                    !data.carts[0].promotions?.some(
                        (promo) => promo?.id === data.promotions[0].id,
                    ) &&
                    data.carts[0].customer?.has_account === true &&
                    (data.carts[0].customer.orders?.length ?? 0) === 0
                );
            },
        ).then(() => {
            const promotionInput = transform({ carts, promotions }, ({ carts, promotions }) => ({
                id: carts[0].id,
                promo_codes: [promotions[0].code!],
                action: PromotionActions.ADD,
            }));

            updateCartPromotionsStep(promotionInput);
        });

        // retrieve updated cart
        const { data: updatedCarts } = useQueryGraphStep({
            entity: "cart",
            fields: ["*", "promotions.*"],
            filters: {
                id: cart_id,
            },
        }).config({ name: "retrieve-updated-cart" });

        return new WorkflowResponse(updatedCarts[0]);
    },
);
