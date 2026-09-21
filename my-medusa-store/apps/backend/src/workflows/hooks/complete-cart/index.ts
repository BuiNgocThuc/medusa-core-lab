import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LOYALTY_MODULE, LoyaltyModuleService } from "@/src/modules/loyalty"
import {
    PROMOTION_ENTITLEMENT_MODULE,
    PromotionEntitlementModuleService,
} from "@/src/modules/promotion-entitlement"
import { validateConditionalPromotions } from "./conditional-promotions"
import { validateCompleteCartFirstPurchasePromotion } from "./first-purchase"
import { validateLoyaltyPoints } from "./loyalty"
import { validateCompleteCartTierPromotions } from "./tier"

export function registerCompleteCartPromotionValidation() {
    completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
        const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
        const { data: [detailedCart] } = await query.graph(
            {
                entity: "cart",
                fields: ["id", "customer_id", "promotions.id", "promotions.code", "customer.tier.id"],
                filters: { id: cart.id },
            },
            { throwIfKeyNotFound: true },
        )
        const promotions = (detailedCart.promotions ?? []).filter(
            (promotion: any): promotion is NonNullable<typeof promotion> => promotion != null,
        )
        if (!promotions.length) return

        await validateCompleteCartTierPromotions(query, promotions, detailedCart.customer?.tier?.id)
        await validateCompleteCartFirstPurchasePromotion(query, promotions, detailedCart.customer_id)

        const entitlementService = container.resolve(
            PROMOTION_ENTITLEMENT_MODULE,
        ) as PromotionEntitlementModuleService
        await validateConditionalPromotions(query, cart.id, entitlementService)

        const loyaltyModuleService = container.resolve(LOYALTY_MODULE) as LoyaltyModuleService
        await validateLoyaltyPoints(query, cart.id, loyaltyModuleService)
    })
}
