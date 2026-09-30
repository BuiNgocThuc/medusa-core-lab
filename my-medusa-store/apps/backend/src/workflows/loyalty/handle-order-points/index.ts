import {
    createWorkflow,
    transform,
    WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
    acquireLockStep,
    releaseLockStep,
    useQueryGraphStep,
} from "@medusajs/medusa/core-flows";
import { processOrderLoyaltyStep } from "./steps";

type WorkflowInput = { order_id: string };

export const handleOrderRedemptionWorkflow = createWorkflow(
    "handle-order-redemption",
    ({ order_id }: WorkflowInput) => {
        const { data: orders } = useQueryGraphStep({
            entity: "order",
            fields: ["id", "customer.id"],
            filters: { id: order_id },
            options: { throwIfKeyNotFound: true },
        });
        const customerLockKey = transform({ orders }, ({ orders }) =>
            orders[0]?.customer?.id
                ? `loyalty-customer-${orders[0].customer.id}`
                : `loyalty-order-${orders[0].id}`,
        );

        acquireLockStep({
            key: customerLockKey,
            timeout: 5,
            ttl: 30,
        });

        const result = processOrderLoyaltyStep({ order_id });

        releaseLockStep({ key: customerLockKey });

        return new WorkflowResponse(result);
    },
);
