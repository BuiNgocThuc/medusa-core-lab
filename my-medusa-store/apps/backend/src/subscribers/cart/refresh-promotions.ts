import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import {
    addTierPromotionToCartWorkflow,
    refreshConditionalPromotionsWorkflow,
} from "@/src/workflows"

export default async function refreshPromotionsHandler({
    event: { data },
    container,
}: SubscriberArgs<{ id: string }>) {
    await refreshConditionalPromotionsWorkflow(container).run({
        input: { cart_id: data.id },
    })
    await addTierPromotionToCartWorkflow(container).run({
        input: { cart_id: data.id },
    })
}

export const config: SubscriberConfig = {
    event: "cart.updated",
}
