import { Promotion, Query } from "../shared/types"
import { validateTierPromotionEligibility } from "../shared/promotion-eligibility"

export async function validateCompleteCartTierPromotions(
    query: Query,
    promotions: Promotion[],
    customerTierId?: string,
) {
    const promotionIds = promotions
        .map((promotion) => promotion.id)
        .filter((id): id is string => Boolean(id))
    if (!promotionIds.length) return

    const { data: tiers } = await query.graph({
        entity: "tier",
        fields: ["id", "promo_id"],
        filters: { promo_id: promotionIds },
    })
    validateTierPromotionEligibility(promotions, tiers, customerTierId)
}
