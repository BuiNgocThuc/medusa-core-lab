import { FIRST_PURCHASE_PROMOTION_CODE } from "@/src/constant"
import { throwInvalidPromotion } from "./errors"
import { Promotion } from "./types"

export type FirstPurchaseCustomer = {
    has_account?: boolean | null
    orders?: Array<{ id: string } | null> | null
}

export type TierPromotion = {
    id: string
    promo_id?: string | null
}

export function hasFirstPurchasePromotion(promotionCodes: Array<string | undefined>) {
    return promotionCodes.includes(FIRST_PURCHASE_PROMOTION_CODE)
}

export function validateFirstPurchaseCustomerEligibility(customer?: FirstPurchaseCustomer) {
    if (!customer?.has_account || (customer.orders?.length ?? 0) > 0) {
        throwInvalidPromotion("Ưu đãi đơn đầu không hợp lệ cho giỏ hàng này")
    }
}

export function validateTierPromotionEligibility(
    promotions: Promotion[],
    tiers: TierPromotion[],
    customerTierId?: string,
) {
    const tierByPromotionId = new Map(
        tiers
            .filter((tier): tier is TierPromotion & { promo_id: string } => Boolean(tier.promo_id))
            .map((tier) => [tier.promo_id, tier.id]),
    )
    for (const promotion of promotions) {
        if (!promotion.id) continue
        const requiredTierId = tierByPromotionId.get(promotion.id)
        if (requiredTierId && customerTierId !== requiredTierId) {
            throwInvalidPromotion(
                `Promotion ${promotion.code ?? promotion.id} can only be applied by customers in the corresponding tier.`,
            )
        }
    }
}
