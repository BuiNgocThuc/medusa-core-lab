import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateCustomerTierOnOrderWorkflow, handleOrderPointsWorkflow } from "@/src/workflows";
export default async function orderPlacedHandler({
    event: { data },
    container,
}: SubscriberArgs<{
    id: string;
}>) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

    try {
        await updateCustomerTierOnOrderWorkflow(container).run({
            input: {
                order_id: data.id,
            },
        });
    } catch (error) {
        logger.error(`Error updating customer tier for order ${data.id}:`, error);
    }

    try {
        await handleOrderPointsWorkflow(container).run({
            input: {
                order_id: data.id,
            },
        });
    } catch (error) {
        logger.error(`Error handling loyalty points for order ${data.id}:`, error);
    }
}

export const config: SubscriberConfig = {
    event: "order.placed",
};
