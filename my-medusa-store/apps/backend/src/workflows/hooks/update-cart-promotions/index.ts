import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, MedusaError, PromotionActions } from "@medusajs/framework/utils"
import { validateAddedCartFirstPurchasePromotion } from "./first-purchase"
import { validateAddedCartTierPromotions } from "./tier"
import {
    FIRST_PURCHASE_PROMOTION_CODE,
    FLASH_PROMOTION_CODE_PREFIX,
    RACKET_SUMMER_GET_SOCK_PROMOTION_CODE,
    VIP_BUNDLE_PROMOTION_CODE,
} from "@/src/constant"

const AUTOMATIC_WORKFLOW_CODES = new Set([
    FIRST_PURCHASE_PROMOTION_CODE,
    VIP_BUNDLE_PROMOTION_CODE,
    RACKET_SUMMER_GET_SOCK_PROMOTION_CODE,
])

function isAutomaticWorkflowPromotion(code?: string | null) {
    return Boolean(code && (
        AUTOMATIC_WORKFLOW_CODES.has(code) ||
        code.startsWith(FLASH_PROMOTION_CODE_PREFIX)
    ))
}

function isLoyaltyPromotion(
    promotion: { id?: string | null; code?: string | null },
    loyaltyPromotionId?: string | null,
) {
    return promotion.id === loyaltyPromotionId || promotion.code?.startsWith("LOYALTY-")
}

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
        const { data: cartResults } = await query.graph({
            entity: "cart",
            fields: ["id", "metadata", "promotions.id", "promotions.code"],
            filters: { id: cart.id },
        })
        const currentCart = cartResults[0]
        const existingCodes = (currentCart?.promotions ?? []).map(
            (promotion: any) => promotion.code,
        ).filter(Boolean)
        const codesToValidate = input.action === PromotionActions.REPLACE
            ? promoCodes
            : [...new Set([...existingCodes, ...promoCodes])]
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
            fields: ["id", "code", "is_automatic"],
            filters: { code: codesToValidate },
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

        const tierPromotionIds = new Set(tiers.map((tier: any) => tier.promo_id))
        const manualPromotionCodes = promotions.filter((promotion: any) =>
            !promotion.is_automatic &&
            !tierPromotionIds.has(promotion.id) &&
            !isAutomaticWorkflowPromotion(promotion.code) &&
            !isLoyaltyPromotion(promotion, currentCart?.metadata?.loyalty_promo_id),
        )
        if (manualPromotionCodes.length > 1) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Mỗi đơn hàng chỉ được dùng một promotion code",
            )
        }
    })
}
