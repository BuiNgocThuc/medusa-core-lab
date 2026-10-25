import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { randomUUID } from "crypto"
import { orderPromotionCodes } from "../../../../utils"

type CartPromotion = {
  id?: string | null
  code?: string | null
  is_automatic?: boolean | null
}

type TierPromotion = {
  promo_id?: string | null
}

type SyncInput = {
  promotions?: CartPromotion[] | null
  metadata?: Record<string, unknown> | null
  loyaltyPromotionId?: string | null
  desiredPromotion?: { id: string; code: string } | null
  tierPromotions?: TierPromotion[] | null
}

export type TierPromotionSyncPlan = {
  promo_codes: string[]
  tier_promotion_ids: string[]
  promotions_changed: boolean
  metadata_changed: boolean
}

function metadataTierPromotionIds(metadata?: Record<string, unknown> | null): string[] {
  const value = metadata?.tier_promotion_ids
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : []
}

function hasTierPromotionIdsMetadata(metadata?: Record<string, unknown> | null) {
  return Array.isArray(metadata?.tier_promotion_ids)
}

/**
 * Produces the complete, stable promotion list owned by the tier sync.
 * Older carts have no metadata, so tier promotions already on the cart are
 * treated as managed when their id belongs to any tier.
 */
export function buildTierPromotionSyncPlan(input: SyncInput): TierPromotionSyncPlan {
  const promotions = (input.promotions ?? []).filter(
    (promotion): promotion is CartPromotion & { code: string } => Boolean(promotion?.code),
  )
  const tierPromotionIds = new Set([
    ...metadataTierPromotionIds(input.metadata),
    ...(input.tierPromotions ?? [])
      .map((tier) => tier.promo_id)
      .filter((id): id is string => Boolean(id)),
  ])
  const managedIds = new Set(
    promotions
      .filter((promotion) => promotion.id && tierPromotionIds.has(promotion.id))
      .map((promotion) => promotion.id!),
  )
  const remaining = promotions.filter((promotion) => !promotion.id || !managedIds.has(promotion.id))
  const nextPromotions = input.desiredPromotion
    ? [...remaining, { ...input.desiredPromotion, is_automatic: false }]
    : remaining
  const promo_codes = orderPromotionCodes(nextPromotions as any, {
    loyaltyPromotionId: input.loyaltyPromotionId,
  })
  const currentCodes = promotions.map((promotion) => promotion.code)
  const tier_promotion_ids = input.desiredPromotion ? [input.desiredPromotion.id] : []
  const previousIds = metadataTierPromotionIds(input.metadata)

  return {
    promo_codes,
    tier_promotion_ids,
    promotions_changed:
      promo_codes.length !== currentCodes.length ||
      promo_codes.some((code, index) => code !== currentCodes[index]),
    metadata_changed:
      !hasTierPromotionIdsMetadata(input.metadata) ||
      tier_promotion_ids.length !== previousIds.length ||
      tier_promotion_ids.some((id, index) => id !== previousIds[index]),
  }
}

type Marker = { cartId: string; promoCodes: string[] }
const markers = new Map<string, Marker>()

export function consumeTierPromotionSyncMarker(
  marker: unknown,
  cartId: string,
  promoCodes: string[] | null | undefined,
) {
  if (typeof marker !== "string") return false
  const expected = markers.get(marker)
  markers.delete(marker)
  return Boolean(
    expected &&
      expected.cartId === cartId &&
      expected.promoCodes.length === (promoCodes?.length ?? 0) &&
      expected.promoCodes.every((code, index) => code === promoCodes?.[index]),
  )
}

export const createTierPromotionSyncMarkerStep = createStep(
  "create-tier-promotion-sync-marker",
  async ({ cart_id, promo_codes }: { cart_id: string; promo_codes: string[] }) => {
    const marker = randomUUID()
    markers.set(marker, { cartId: cart_id, promoCodes: promo_codes })
    return new StepResponse(marker, marker)
  },
  async (marker) => {
    if (typeof marker === "string") markers.delete(marker)
  },
)
