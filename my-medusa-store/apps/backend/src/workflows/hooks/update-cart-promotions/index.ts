import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, MedusaError, PromotionActions } from "@medusajs/framework/utils"
import { validateAddedCartFirstPurchasePromotion } from "./first-purchase"
import { consumeTierPromotionSyncMarker } from "../../customer-tier/add-tier-promotion-to-cart/steps"
import {
    FIRST_PURCHASE_PROMOTION_CODE,
    FLASH_PROMOTION_CODE_PREFIX,
    VIP_BUNDLE_PROMOTION_CODE,
} from "../../../constant"

const AUTOMATIC_WORKFLOW_CODES = new Set([
    FIRST_PURCHASE_PROMOTION_CODE,
    VIP_BUNDLE_PROMOTION_CODE,
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

function isPromotionUpdate(
    action: PromotionActions | undefined,
    promoCodes?: string[] | null,
): promoCodes is string[] {
    return (action === PromotionActions.ADD || action === PromotionActions.REPLACE) && Array.isArray(promoCodes)
}

function tierPromotionIds(metadata: Record<string, unknown> | null | undefined) {
    const ids = metadata?.tier_promotion_ids
    return Array.isArray(ids)
        ? ids.filter((id): id is string => typeof id === "string")
        : []
}

function throwTierPromotionNotAllowed() {
    throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Ưu đãi hạng thành viên được áp dụng tự động.",
    )
}

function isSystemPromotionRefresh(input: {
    force_refresh_payment_collection?: boolean
}) {
    // Medusa's line-item/cart refresh workflow uses this internal flag while
    // re-evaluating the cart's existing promotions. It is not the Store API's
    // promotion-code operation and must be allowed to recalculate a managed
    // tier promotion after an item changes.
    return input.force_refresh_payment_collection === false
}

export function registerUpdateCartPromotionValidation() {
    updateCartPromotionsWorkflow.hooks.validate(async ({ input, cart }, { container }) => {
        if (!isPromotionUpdate(input.action, input.promo_codes)) return

        const promoCodes = input.promo_codes
        const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
        const { data: cartResults } = await query.graph({
            entity: "cart",
            fields: ["id", "metadata", "promotions.id", "promotions.code"],
            filters: { id: cart.id },
        })
        const currentCart = cartResults[0]
        const isTierSync = consumeTierPromotionSyncMarker(
            (input as any).tier_promotion_sync_marker,
            cart.id,
            promoCodes,
        )
        const isTrustedPromotionUpdate =
            isTierSync || isSystemPromotionRefresh(input)
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

        const promotionResults = codesToValidate.length
            ? (await query.graph({
                entity: "promotion",
                fields: ["id", "code", "is_automatic", "metadata"],
                filters: { code: codesToValidate },
            })).data
            : []
        const promotions = (promotionResults ?? []).filter(
            (promotion: any): promotion is NonNullable<typeof promotion> => promotion != null,
        )
        const { data: tierResults } = await query.graph({
            entity: "tier",
            fields: ["id", "promo_id"],
        })
        const tiers = (tierResults ?? []).filter((tier: any) => tier != null)
        const tierPromotionIdSet = new Set(
            tiers.map((tier: any) => tier.promo_id).filter(Boolean),
        )
        const managedTierPromotionIds = new Set([
            ...tierPromotionIds(currentCart?.metadata),
            ...(currentCart?.promotions ?? [])
                .filter((promotion: any) => tierPromotionIdSet.has(promotion.id))
                .map((promotion: any) => promotion.id),
        ])
        const requestedTierPromotionIds = new Set(
            promotions
                .filter((promotion: any) => tierPromotionIdSet.has(promotion.id))
                .map((promotion: any) => promotion.id),
        )

        if (!isTrustedPromotionUpdate) {
            if (promotions.some((promotion: any) => promotion.metadata?.source === "conditional-promotion-engine")) {
                throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Ưu đãi tự động không thể áp dụng bằng mã.")
            }
            if (input.action === PromotionActions.ADD && requestedTierPromotionIds.size) {
                throwTierPromotionNotAllowed()
            }
            if (input.action === PromotionActions.REPLACE) {
                const sameTierPromotions =
                    requestedTierPromotionIds.size === managedTierPromotionIds.size &&
                    [...managedTierPromotionIds].every((id) => requestedTierPromotionIds.has(id))
                if (!sameTierPromotions) throwTierPromotionNotAllowed()
            }
        }

        if (!promotions.length) return

        const manualPromotionCodes = promotions.filter((promotion: any) =>
            !promotion.is_automatic &&
            !tierPromotionIdSet.has(promotion.id) &&
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
