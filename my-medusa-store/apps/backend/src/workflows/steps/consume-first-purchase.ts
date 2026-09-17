import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
    PROMOTION_ENTITLEMENT_MODULE,
    PromotionEntitlementModuleService,
} from "@/src/modules/promotion-entitlement"

type ConsumeFirstPurchaseInput = {
    customer_id: string
    cart_id: string
    order_id: string
}

export const consumeFirstPurchaseStep = createStep(
    "consume-first-purchase",
    async ({ customer_id, cart_id, order_id }: ConsumeFirstPurchaseInput, { container }) => {
        const entitlementService: PromotionEntitlementModuleService = container.resolve(
            PROMOTION_ENTITLEMENT_MODULE,
        )
        const entitlement = await entitlementService.consumeFirstPurchase(customer_id, cart_id, order_id)

        return new StepResponse(entitlement)
    },
)
