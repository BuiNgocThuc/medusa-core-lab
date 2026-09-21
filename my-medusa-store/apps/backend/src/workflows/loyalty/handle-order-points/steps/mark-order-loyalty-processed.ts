import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";

type MarkOrderLoyaltyProcessedInput = {
    order_id: string;
    metadata?: Record<string, unknown> | null;
    key: "loyalty_processed";
};

export const markOrderLoyaltyProcessedStep = createStep(
    "mark-order-loyalty-processed",
    async ({ order_id, metadata, key }: MarkOrderLoyaltyProcessedInput, { container }) => {
        const orderModule = container.resolve(Modules.ORDER) as any;
        const nextMetadata = {
            ...(metadata ?? {}),
            [key]: true,
        };

        await orderModule.updateOrders({
            id: order_id,
            metadata: nextMetadata,
        });

        return new StepResponse(nextMetadata, { order_id, metadata });
    },
    async (data, { container }) => {
        if (!data) return;

        const orderModule = container.resolve(Modules.ORDER) as any;
        await orderModule.updateOrders({
            id: data.order_id,
            metadata: data.metadata ?? {},
        });
    },
);
