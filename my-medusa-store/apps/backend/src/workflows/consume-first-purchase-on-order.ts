import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { FIRST_PURCHASE_PROMOTION_CODE } from "@/src/constant"
import { consumeFirstPurchaseStep } from "./steps"

export const consumeFirstPurchaseOnOrderWorkflow = createWorkflow(
    "consume-first-purchase-on-order",
    ({ order_id }: { order_id: string }) => {
        const { data: orders } = useQueryGraphStep({
            entity: "order",
            fields: ["id", "customer.id", "cart.id", "cart.promotions.code"],
            filters: { id: order_id },
            options: { throwIfKeyNotFound: true },
        })

        const shouldConsume = transform({ orders }, ({ orders }) =>
            Boolean(
                orders[0]?.customer?.id &&
                    orders[0]?.cart?.id &&
                    orders[0]?.cart?.promotions?.some(
                        (promotion) => promotion?.code === FIRST_PURCHASE_PROMOTION_CODE,
                    ),
            ),
        )

        const consumeInput = transform({ orders }, ({ orders }) => ({
            customer_id: orders[0].customer!.id,
            cart_id: orders[0].cart!.id,
            order_id,
        }))

        when({ shouldConsume }, ({ shouldConsume }) => shouldConsume).then(() => {
            return consumeFirstPurchaseStep(consumeInput)
        })

        return new WorkflowResponse({ order_id })
    },
)
