import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { FLASH_PROMOTION_CODE_PREFIX } from "@/src/constant"
import {
    PROMOTION_ENTITLEMENT_MODULE,
    PromotionEntitlementModuleService,
} from "@/src/modules/promotion-entitlement"

export default async function consumeFlashPromotionHandler({
    event: { data },
    container,
}: SubscriberArgs<{ id: string }>) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

    try {
        const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
        const { data: orders } = await query.graph({
            entity: "order",
            fields: ["id", "cart.id", "cart.promotions.code"],
            filters: { id: data.id },
        })
        const order = orders[0]
        const hasFlashPromotion = order?.cart?.promotions?.some((promotion: any) =>
            promotion?.code?.startsWith(FLASH_PROMOTION_CODE_PREFIX),
        )

        if (!hasFlashPromotion || !order?.cart?.id) return

        const entitlementService = container.resolve(
            PROMOTION_ENTITLEMENT_MODULE,
        ) as PromotionEntitlementModuleService
        await entitlementService.consumeFlashRedemption(order.cart.id, data.id)
    } catch (error) {
        logger.error(`Error consuming Flash Promotion for order ${data.id}:`, error)
    }
}

export const config: SubscriberConfig = {
    event: "order.placed",
}
