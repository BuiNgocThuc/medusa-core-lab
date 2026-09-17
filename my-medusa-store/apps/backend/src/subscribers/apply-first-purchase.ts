import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { applyFirstPurchasePromoWorkflow } from "@/src/workflows";

export default async function cartCreatedHandler({
    event: { data },
    container,
}: SubscriberArgs<{ id: string }>) {
    await applyFirstPurchasePromoWorkflow(container).run({
        input: {
            cart_id: data.id,
        },
    });
}

export const config: SubscriberConfig = {
    event: ["cart.created", "cart.customer_transferred", "cart.updated"],
};
