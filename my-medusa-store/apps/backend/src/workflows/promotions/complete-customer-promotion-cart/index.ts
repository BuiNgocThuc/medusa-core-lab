import {
    createWorkflow,
    transform,
    when,
    WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
    acquireLockStep,
    completeCartWorkflow,
    releaseLockStep,
    useQueryGraphStep,
} from "@medusajs/medusa/core-flows";
import { FIRST_PURCHASE_PROMOTION_CODE } from "@/src/constant";

type CompleteCustomerPromotionCartInput = {
    cart_id: string;
};

export const completeCustomerPromotionCartWorkflow = createWorkflow(
    "complete-customer-promotion-cart",
    (input: CompleteCustomerPromotionCartInput) => {
        const { data: carts } = useQueryGraphStep({
            entity: "cart",
            fields: ["id", "customer_id", "metadata", "promotions.id", "promotions.code"],
            filters: { id: input.cart_id },
            options: { throwIfKeyNotFound: true },
        });
        const lockKeys = transform({ carts }, ({ carts }) => {
            const cart = carts[0];
            const keys = [cart.id];

            const hasFirstPurchasePromo = cart.promotions?.some(
                (promo) => promo?.code === FIRST_PURCHASE_PROMOTION_CODE,
            );
            const hasLoyaltyPromo = Boolean(
                cart.metadata?.loyalty_promo_id &&
                cart.promotions?.some((promo) => promo?.id === cart.metadata?.loyalty_promo_id),
            );

            if ((hasFirstPurchasePromo || hasLoyaltyPromo) && cart.customer_id) {
                keys.push(`customer-promotion-${cart.customer_id}`);
            }

            return keys;
        });

        acquireLockStep({ key: lockKeys, timeout: 30, ttl: 120 });

        const { data: orderCart } = useQueryGraphStep({
            entity: "order_cart",
            fields: ["order_id"],
            filters: { cart_id: input.cart_id },
            options: { isList: false },
        }).config({ name: "retrieve-existing-order" });
        const existingOrderId = transform({ orderCart }, ({ orderCart }) =>
            orderCart?.order_id ?? null,
        );
        const completedOrder = when(
            { existingOrderId },
            ({ existingOrderId }) => !existingOrderId,
        ).then(() =>
            completeCartWorkflow.runAsStep({
                input: { id: input.cart_id },
            }),
        );
        const orderId = transform(
            { existingOrderId, completedOrder },
            ({ existingOrderId, completedOrder }) => existingOrderId ?? completedOrder?.id,
        );

        releaseLockStep({
            key: lockKeys,
        });

        return new WorkflowResponse({ id: orderId });
    },
);
