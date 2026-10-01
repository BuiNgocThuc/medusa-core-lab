import { buildTierPromotionSyncPlan } from "../sync-tier-promotion"

describe("tier promotion sync", () => {
  const automatic = { id: "auto", code: "AUTO", is_automatic: true }
  const coupon = { id: "coupon", code: "SAVE10", is_automatic: false }
  const loyalty = { id: "loyalty", code: "LOYALTY-1", is_automatic: false }
  const oldTier = { id: "tier-old", code: "TIER-OLD", is_automatic: false }
  const vipTier = { id: "tier-vip", code: "TIER-VIP", is_automatic: false }

  it("adds the eligible tier promotion without removing ordinary or loyalty promotions", () => {
    expect(buildTierPromotionSyncPlan({
      promotions: [automatic, coupon, loyalty],
      metadata: { loyalty_promo_id: loyalty.id },
      loyaltyPromotionId: loyalty.id,
      desiredPromotion: vipTier,
      tierPromotions: [{ promo_id: vipTier.id }],
    })).toMatchObject({
      promo_codes: ["AUTO", "SAVE10", "TIER-VIP", "LOYALTY-1"],
      tier_promotion_ids: ["tier-vip"],
      promotions_changed: true,
      metadata_changed: true,
    })
  })

  it("does not write again when the cart is already synchronized", () => {
    expect(buildTierPromotionSyncPlan({
      promotions: [automatic, coupon, vipTier, loyalty],
      metadata: { loyalty_promo_id: loyalty.id, tier_promotion_ids: [vipTier.id] },
      loyaltyPromotionId: loyalty.id,
      desiredPromotion: vipTier,
      tierPromotions: [{ promo_id: vipTier.id }],
    })).toMatchObject({
      promotions_changed: false,
      metadata_changed: false,
    })
  })

  it("removes an obsolete tier promotion and normalizes legacy cart metadata", () => {
    expect(buildTierPromotionSyncPlan({
      promotions: [automatic, oldTier, coupon, loyalty],
      metadata: { loyalty_promo_id: loyalty.id },
      loyaltyPromotionId: loyalty.id,
      desiredPromotion: null,
      tierPromotions: [{ promo_id: oldTier.id }],
    })).toMatchObject({
      promo_codes: ["AUTO", "SAVE10", "LOYALTY-1"],
      tier_promotion_ids: [],
      promotions_changed: true,
      metadata_changed: true,
    })
  })
})
