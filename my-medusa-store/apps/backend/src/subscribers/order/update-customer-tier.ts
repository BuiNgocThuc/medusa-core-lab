import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateCustomerTierOnOrderWorkflow } from "@/src/workflows"

export default async function updateCustomerTierHandler({
    event: { data },
    container,
}: SubscriberArgs<{ id: string }>) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

    try {
        await updateCustomerTierOnOrderWorkflow(container).run({
            input: { order_id: data.id },
        })
    } catch (error) {
        logger.error(`Error updating customer tier for order ${data.id}:`, error)
    }
}

export const config: SubscriberConfig = {
    event: "order.placed",
}
