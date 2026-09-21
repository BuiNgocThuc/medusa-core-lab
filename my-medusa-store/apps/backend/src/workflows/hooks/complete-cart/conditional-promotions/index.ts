import {
    FLASH_PROMOTION_CODE_PREFIX,
    RACKET_SUMMER_GET_SOCK_PROMOTION_CODE,
    VIP_BUNDLE_PROMOTION_CODE,
} from "@/src/constant"
import { PromotionEntitlementModuleService } from "@/src/modules/promotion-entitlement"
import { throwInvalidPromotion } from "../../shared/errors"
import { Query } from "../../shared/types"
import { validateBuyRacketGetSock } from "./buy-racket-get-sock"
import { validateFlashPromotion } from "./flash"
import { validateVipBundle } from "./vip-bundle"

export async function validateConditionalPromotions(
    query: Query,
    cartId: string,
    entitlementService: PromotionEntitlementModuleService,
) {
    const { data } = await query.graph({
        entity: "cart",
        fields: [
            "id", "subtotal", "customer.id", "customer.tier.name", "region.name",
            "shipping_address.country_code", "promotions.code", "items.quantity",
            "items.variant.product.product_categories.name", "items.variant.product.collection.handle",
        ],
        filters: { id: cartId },
    })
    const cart = data[0]
    const codes = (cart?.promotions ?? []).map((promotion: any) => promotion.code).filter(Boolean)
    if (codes.length > 1) throwInvalidPromotion("Mỗi đơn hàng chỉ được dùng một promotion")

    const code = codes[0]
    if (code === VIP_BUNDLE_PROMOTION_CODE) validateVipBundle(cart)
    if (code === RACKET_SUMMER_GET_SOCK_PROMOTION_CODE) validateBuyRacketGetSock(cart)
    if (code?.startsWith(FLASH_PROMOTION_CODE_PREFIX)) {
        await validateFlashPromotion(cart, entitlementService)
    }
}
