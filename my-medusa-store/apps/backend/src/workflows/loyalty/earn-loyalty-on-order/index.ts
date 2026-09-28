import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { acquireLockStep, releaseLockStep, useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { earnLoyaltyOnOrderStep } from "./steps";

type EarnLoyaltyOnOrderInput = {
    order_id: string;
};

export const earnLoyaltyOnOrderWorkflow = createWorkflow(
    "earn-loyalty-on-order",
    ({ order_id }: EarnLoyaltyOnOrderInput) => {
        const { data: orders } = useQueryGraphStep({
            entity: "order",
            fields: ["id", "customer.id"],
            filters: { id: order_id },
            options: { throwIfKeyNotFound: true },
        });
        const lockKey = transform(
            { orders },
            ({ orders }) => `loyalty-customer-${orders[0].customer!.id}`,
        );

        acquireLockStep({ key: lockKey, timeout: 5, ttl: 30 });
        const result = earnLoyaltyOnOrderStep({ order_id });
        releaseLockStep({ key: lockKey });

        return new WorkflowResponse(result);
    },
);
