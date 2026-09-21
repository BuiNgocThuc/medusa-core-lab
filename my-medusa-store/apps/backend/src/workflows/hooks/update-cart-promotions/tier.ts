import { Promotion } from "../shared/types"
import { TierPromotion, validateTierPromotionEligibility } from "../shared/promotion-eligibility"

export function validateAddedCartTierPromotions(
    promotions: Promotion[],
    tiers: TierPromotion[],
    customerTierId?: string,
) {
    validateTierPromotionEligibility(promotions, tiers, customerTierId)
}
