import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { LOYALTY_MODULE, LoyaltyModuleService } from "@/src/modules/loyalty";
import { CartData, getCartLoyaltyPromotion } from "@/src/utils";

type ProcessOrderLoyaltyInput = { order_id: string };

export const processOrderLoyaltyStep = createStep(
    "process-order-loyalty",
    async ({ order_id }: ProcessOrderLoyaltyInput, { container }) => {
        const query = container.resolve(ContainerRegistrationKeys.QUERY) as any;
        const orderModule = container.resolve(Modules.ORDER) as any;
        const promotionModule = container.resolve(Modules.PROMOTION) as any;
        const loyaltyModule = container.resolve(LOYALTY_MODULE) as LoyaltyModuleService;
        const { data: [order] } = await query.graph({
            entity: "order",
            fields: ["id", "total", "metadata", "customer.id", "cart.id", "cart.metadata", "cart.promotions.*", "cart.promotions.rules.*", "cart.promotions.rules.values.*", "cart.promotions.application_method.*"],
            filters: { id: order_id },
        }, { throwIfKeyNotFound: true });

        if (order.metadata?.loyalty_processed === true) {
            return new StepResponse({ skipped: true });
        }

        const loyaltyPromotion = getCartLoyaltyPromotion(order.cart as CartData);
        let redeemedPoints = 0;

        if (loyaltyPromotion?.status === "active") {
            redeemedPoints = await loyaltyModule.calculatePointsFromDiscountAmount(
                loyaltyPromotion.application_method!.value as number,
            );
            await loyaltyModule.consumeReservationForOrder({
                order_id: order.id,
                customer_id: order.customer.id,
                cart_id: order.cart.id,
                promotion_id: loyaltyPromotion.id,
                points: redeemedPoints,
            });
            await promotionModule.updatePromotions(loyaltyPromotion.id, { status: "inactive" });
        } else {
            const earnedPoints = await loyaltyModule.calculatePointsFromAmount(order.total);
            await loyaltyModule.recordTransaction({
                customer_id: order.customer.id,
                type: "add",
                reference_id: order.id,
                points: earnedPoints,
                order_id: order.id,
            });
        }
        await orderModule.updateOrders({
            id: order.id,
            metadata: { ...(order.metadata ?? {}), loyalty_processed: true },
        });

        return new StepResponse({
            skipped: false,
            earned_points: loyaltyPromotion ? 0 : await loyaltyModule.calculatePointsFromAmount(order.total),
            redeemed_points: redeemedPoints,
        });
    },
);
