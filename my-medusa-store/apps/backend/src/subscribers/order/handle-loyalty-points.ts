import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { earnLoyaltyOnOrderWorkflow, handleOrderRedemptionWorkflow } from "@/src/workflows"

export default async function handleOrderPointsHandler({
    event: { data },
    container,
}: SubscriberArgs<{ id: string }>) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

    try {
        const { result } = await earnLoyaltyOnOrderWorkflow(container).run({
            input: { order_id: data.id },
        })
        logger.info(
            `Loyalty subscriber action successfully completed for order ${data.id}: ${result.earned_points} point(s)${result.skipped ? " (already processed)" : ""}`,
        )
    } catch (error) {
        logger.error(`Error earning loyalty points for order ${data.id}:`, error)
    }

    try {
        await handleOrderRedemptionWorkflow(container).run({
            input: { order_id: data.id },
        })
    } catch (error) {
        logger.error(`Error redeeming loyalty points for order ${data.id}:`, error)
    }
}

export const config: SubscriberConfig = {
    event: "order.placed",
}
