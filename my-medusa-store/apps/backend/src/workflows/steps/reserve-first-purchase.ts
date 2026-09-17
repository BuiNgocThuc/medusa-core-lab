import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
    PROMOTION_ENTITLEMENT_MODULE,
    PromotionEntitlementModuleService,
} from "@/src/modules/promotion-entitlement"

type ReserveFirstPurchaseInput = {
    customer_id: string
    cart_id: string
}

export const reserveFirstPurchaseStep = createStep(
    "reserve-first-purchase",
    async ({ customer_id, cart_id }: ReserveFirstPurchaseInput, { container }) => {
        const entitlementService: PromotionEntitlementModuleService = container.resolve(
            PROMOTION_ENTITLEMENT_MODULE,
        )
        const entitlement = await entitlementService.reserveFirstPurchase(customer_id, cart_id)

        return new StepResponse(entitlement, { cart_id })
    },
    async (data, { container }) => {
        if (!data?.cart_id) {
            return
        }

        const entitlementService: PromotionEntitlementModuleService = container.resolve(
            PROMOTION_ENTITLEMENT_MODULE,
        )
        await entitlementService.releaseFirstPurchase(data.cart_id)
    },
)
