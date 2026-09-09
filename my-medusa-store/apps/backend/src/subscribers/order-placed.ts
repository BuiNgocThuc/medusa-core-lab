import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { handleOrderLoyaltyAndTierWorkflow } from "../workflows/handle-order-loyalty-and-tier"

export default async function handleOrderPlaced({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await handleOrderLoyaltyAndTierWorkflow(container).run({
    input: { order_id: data.id },
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
