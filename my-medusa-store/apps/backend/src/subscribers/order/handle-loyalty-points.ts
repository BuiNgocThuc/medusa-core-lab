import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { handleOrderPointsWorkflow } from "@/src/workflows"

export default async function handleOrderPointsHandler({
    event: { data },
    container,
}: SubscriberArgs<{ id: string }>) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

    try {
        await handleOrderPointsWorkflow(container).run({
            input: { order_id: data.id },
        })
    } catch (error) {
        logger.error(`Error handling loyalty points for order ${data.id}:`, error)
    }
}

export const config: SubscriberConfig = {
    event: "order.placed",
}
