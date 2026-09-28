import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils";
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
        const {
            data: [order],
        } = await query.graph(
            {
                entity: "order",
                fields: [
                    "id",
                    "metadata",
                    "customer.id",
                    "items.subtotal",
                    "items.discount_total",
                    "cart.id",
                    "cart.metadata",
                    "cart.promotions.*",
                    "cart.promotions.rules.*",
                    "cart.promotions.rules.values.*",
                    "cart.promotions.application_method.*",
                ],
                filters: { id: order_id },
            },
            { throwIfKeyNotFound: true },
        );

        if (order.metadata?.loyalty_redemption_processed === true) {
            return new StepResponse({ skipped: true });
        }

        const loyaltyPromotion = getCartLoyaltyPromotion(order.cart as CartData);
        let redeemedPoints = 0;

        if (loyaltyPromotion) {
            const [reservation] = await loyaltyModule.listLoyaltyReservations({
                cart_id: order.cart.id,
            });

            if (!reservation) {
                throw new MedusaError(
                    MedusaError.Types.NOT_FOUND,
                    "Loyalty reservation not found for order cart",
                );
            }

            redeemedPoints = reservation.points;
            await loyaltyModule.consumeReservationForOrder({
                order_id: order.id,
                customer_id: order.customer.id,
                cart_id: order.cart.id,
                promotion_id: loyaltyPromotion.id,
                points: redeemedPoints,
            });
            if (loyaltyPromotion.status === "active") {
                await promotionModule.updatePromotions(loyaltyPromotion.id, { status: "inactive" });
            }
        }
        if (!loyaltyPromotion) {
            return new StepResponse({ skipped: true, redeemed_points: 0 });
        }

        await orderModule.updateOrders({
            id: order.id,
            metadata: { ...(order.metadata ?? {}), loyalty_redemption_processed: true },
        });

        return new StepResponse({
            skipped: false,
            redeemed_points: redeemedPoints,
        });
    },
);
