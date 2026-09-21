import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, PromotionActions } from "@medusajs/framework/utils"
import { validateAddedCartFirstPurchasePromotion } from "./first-purchase"
import { validateAddedCartTierPromotions } from "./tier"

function isAddingPromotions(
    action: PromotionActions | undefined,
    promoCodes?: string[] | null,
): promoCodes is string[] {
    return (action === PromotionActions.ADD || action === PromotionActions.REPLACE) && Boolean(promoCodes?.length)
}

export function registerUpdateCartPromotionValidation() {
    updateCartPromotionsWorkflow.hooks.validate(async ({ input, cart }, { container }) => {
        if (!isAddingPromotions(input.action, input.promo_codes)) return

        const promoCodes = input.promo_codes
        const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
        const customerResult = cart.customer_id
            ? await query.graph({
                entity: "customer",
                fields: ["id", "has_account", "orders.id", "tier.id"],
                filters: { id: cart.customer_id },
            })
            : null
        const customer = customerResult?.data?.[0]
        validateAddedCartFirstPurchasePromotion(promoCodes, customer)

        const { data: promotionResults } = await query.graph({
            entity: "promotion",
            fields: ["id", "code"],
            filters: { code: promoCodes },
        })
        const promotions = (promotionResults ?? []).filter(
            (promotion: any): promotion is NonNullable<typeof promotion> => promotion != null,
        )
        if (!promotions.length) return

        const { data: tierResults } = await query.graph({
            entity: "tier",
            fields: ["id", "promo_id"],
            filters: { promo_id: promotions.map((promotion: any) => promotion.id) },
        })
        const tiers = (tierResults ?? []).filter((tier: any) => tier != null)
        validateAddedCartTierPromotions(promotions, tiers, customer?.tier?.id)
    })
}
