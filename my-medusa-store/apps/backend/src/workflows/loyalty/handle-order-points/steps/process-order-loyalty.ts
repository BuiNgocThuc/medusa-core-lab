import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils";
import { LOYALTY_MODULE, LoyaltyModuleService } from "@/src/modules/loyalty";
import { CartData, getCartLoyaltyPromotion } from "@/src/utils";

type ProcessOrderLoyaltyInput = { order_id: string };

type ProcessOrderLoyaltyOutput = {
    skipped: boolean;
    reason?: string;
    redeemed_points?: number;
    earned_points?: number;
};

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
                    "items.unit_price",
                    "items.quantity",
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

        if (!order || !order.customer?.id) {
            return new StepResponse<ProcessOrderLoyaltyOutput>({ skipped: true, reason: "No customer linked to order" });
        }

        if (order.metadata?.loyalty_redemption_processed === true || order.metadata?.loyalty_processed === true) {
            return new StepResponse<ProcessOrderLoyaltyOutput>({ skipped: true, reason: "Already processed" });
        }

        const loyaltyPromotion = order.cart ? getCartLoyaltyPromotion(order.cart as CartData) : undefined;
        let redeemedPoints = 0;

        if (loyaltyPromotion && order.cart?.id) {
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

        const eligibleAmount = (order.items ?? []).reduce(
            (total: number, item: { subtotal?: number; unit_price?: number; quantity?: number; discount_total?: number }) => {
                const subtotal = item.subtotal ?? (Number(item.unit_price ?? 0) * Number(item.quantity ?? 0));
                const discount = item.discount_total ?? 0;
                return total + Math.max(0, subtotal - discount);
            },
            0,
        );

        const earnedPoints = await loyaltyModule.calculatePointsFromAmount(eligibleAmount);
        if (earnedPoints > 0) {
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
            metadata: {
                ...(order.metadata ?? {}),
                loyalty_redemption_processed: true,
                loyalty_processed: true,
            },
        });

        return new StepResponse<ProcessOrderLoyaltyOutput>({
            skipped: false,
            redeemed_points: redeemedPoints,
            earned_points: earnedPoints ?? 0,
        });
    },
);

