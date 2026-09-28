import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { LOYALTY_MODULE, LoyaltyModuleService } from "@/src/modules/loyalty";

type EarnLoyaltyOnOrderInput = {
    order_id: string;
};

export const earnLoyaltyOnOrderStep = createStep(
    "earn-loyalty-on-order",
    async ({ order_id }: EarnLoyaltyOnOrderInput, { container }) => {
        const query = container.resolve(ContainerRegistrationKeys.QUERY) as any;
        const orderModule = container.resolve(Modules.ORDER) as any;
        const loyalty = container.resolve(LOYALTY_MODULE) as LoyaltyModuleService;
        const {
            data: [order],
        } = await query.graph(
            {
                entity: "order",
                fields: [
                    "id",
                    "metadata",
                    "customer.id",
                    "items.unit_price",
                    "items.detail.quantity",
                    "items.adjustments.amount",
                ],
                filters: { id: order_id },
            },
            { throwIfKeyNotFound: true },
        );

        const [existingTransaction] = await loyalty.listLoyaltyTransactions({
            type: "add",
            reference_id: order.id,
        });
        if (existingTransaction) {
            return new StepResponse({ skipped: true, earned_points: existingTransaction.points });
        }

        const eligibleAmount = (order.items ?? []).reduce((total: number, item: any) => {
            const subtotal = Number(item.unit_price ?? 0) * Number(item.detail?.quantity ?? 0);

            const discountTotal = (item.adjustments ?? []).reduce(
                (discount: number, adjustment: { amount?: number }) =>
                    discount + Number(adjustment.amount ?? 0),
                0,
            );

            return total + Math.max(0, subtotal - discountTotal);
        }, 0);

        const earnedPoints = await loyalty.calculatePointsFromAmount(eligibleAmount);

        await loyalty.recordTransaction({
            customer_id: order.customer.id,
            type: "add",
            reference_id: order.id,
            points: earnedPoints,
            order_id: order.id,
        });
        await orderModule.updateOrders({
            id: order.id,
            metadata: { ...(order.metadata ?? {}), loyalty_earned_processed: true },
        });

        return new StepResponse({ skipped: false, earned_points: earnedPoints });
    },
);
