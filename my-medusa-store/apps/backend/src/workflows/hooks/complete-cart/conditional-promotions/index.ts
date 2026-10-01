import {
    FLASH_PROMOTION_CODE_PREFIX,
    VIP_BUNDLE_PROMOTION_CODE,
} from "@/constant"
import { PromotionEntitlementModuleService } from "@/modules/promotion-entitlement"
import { ConditionalPromotionModuleService } from "../../../../modules/conditional-promotion"
import { evaluateConditionalPromotion } from "../../../conditional-promotions/evaluate-rule-tree"
import { throwInvalidPromotion } from "../../shared/errors"
import { Query } from "../../shared/types"
import { validateFlashPromotion } from "./flash"
import { validateVipBundle } from "./vip-bundle"

export async function validateConditionalPromotions(
    query: Query,
    cartId: string,
    entitlementService: PromotionEntitlementModuleService,
    conditionalService?: ConditionalPromotionModuleService,
) {
    const { data } = await query.graph({
        entity: "cart",
        fields: [
            "id", "subtotal", "customer.id", "customer.tier.name", "region.name",
            "shipping_address.country_code", "promotions.id", "promotions.code", "items.quantity", "items.unit_price",
            "items.variant.product.id", "items.variant.product.product_categories.name", "items.variant.product.product_categories.id", "items.variant.product.collection.handle", "items.variant.product.collection.id", "items.variant.product.type.id", "items.variant.product.tags.id",
        ],
        filters: { id: cartId },
    })
    const cart = data[0]
    const codes = (cart?.promotions ?? []).map((promotion: any) => promotion.code).filter(Boolean)
    const conditionalCodes = codes.filter((code: string) =>
        code === VIP_BUNDLE_PROMOTION_CODE ||
        code.startsWith(FLASH_PROMOTION_CODE_PREFIX),
    )
    if (conditionalCodes.length > 1) {
        throwInvalidPromotion("Mỗi đơn hàng chỉ được dùng một conditional promotion")
    }

    const code = conditionalCodes[0]
    if (code === VIP_BUNDLE_PROMOTION_CODE) validateVipBundle(cart)
    if (code?.startsWith(FLASH_PROMOTION_CODE_PREFIX)) {
        await validateFlashPromotion(cart, entitlementService)
    }
    if (conditionalService) {
        const [configs] = await conditionalService.listAndCountConditionalPromotions({ status: "active" })
        const applied = new Set((cart?.promotions ?? []).map((promotion: any) => promotion.id))
        for (const config of configs as any[]) {
            if (applied.has(config.promo_id) && !evaluateConditionalPromotion(config, cart.items ?? [])) {
                throwInvalidPromotion("Ưu đãi tự động không còn đủ điều kiện")
            }
        }
    }
}
