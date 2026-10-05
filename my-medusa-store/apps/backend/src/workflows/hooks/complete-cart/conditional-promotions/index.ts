import {
    FLASH_PROMOTION_CODE_PREFIX,
    VIP_BUNDLE_PROMOTION_CODE,
} from "@/constant"
import { PromotionEntitlementModuleService } from "@/modules/promotion-entitlement"
import { ConditionalPromotionModuleService } from "../../../../modules/conditional-promotion"
import { FlashSaleScheduleModuleService } from "../../../../modules/flash-sale-schedule"
import { evaluateConditionalPromotion } from "../../../conditional-promotions/evaluate-rule-tree"
import { throwInvalidPromotion } from "../../shared/errors"
import { Query } from "../../shared/types"
import { validateFlashSale } from "@/workflows/flash-sales"
import { validateVipBundle } from "./vip-bundle"

export async function validateConditionalPromotions(
    query: Query,
    cartId: string,
    entitlementService: PromotionEntitlementModuleService,
    conditionalService?: ConditionalPromotionModuleService,
    flashScheduleService?: FlashSaleScheduleModuleService,
    promotionService?: any,
) {
    const { data } = await query.graph({
        entity: "cart",
        fields: [
            "id", "subtotal", "customer.id", "customer.tier.name", "region.name",
            "shipping_address.country_code", "promotions.id", "promotions.code", "promotions.metadata", "items.quantity", "items.unit_price",
            "items.variant.product.id", "items.variant.product.product_categories.name", "items.variant.product.product_categories.id", "items.variant.product.collection.handle", "items.variant.product.collection.id", "items.variant.product.type.id", "items.variant.product.tags.id",
        ],
        filters: { id: cartId },
    })
    const cart = data[0]
    const codes = (cart?.promotions ?? []).map((promotion: any) => promotion.code).filter(Boolean)
    const conditionalCodes = codes.filter((code: string) =>
        code === VIP_BUNDLE_PROMOTION_CODE ||
        code.startsWith(FLASH_PROMOTION_CODE_PREFIX) || cart?.promotions?.some((promotion: any) => promotion.code === code && promotion.metadata?.source === "flash-sale-schedule"),
    )
    if (conditionalCodes.length > 1) {
        throwInvalidPromotion("Mỗi đơn hàng chỉ được dùng một conditional promotion")
    }

    const code = conditionalCodes[0]
    if (code === VIP_BUNDLE_PROMOTION_CODE) validateVipBundle(cart)
    if (code?.startsWith(FLASH_PROMOTION_CODE_PREFIX) || cart?.promotions?.some((promotion: any) => promotion.code === code && promotion.metadata?.source === "flash-sale-schedule")) {
        if (!flashScheduleService || !promotionService) throwInvalidPromotion("Flash Sale service unavailable")
        await validateFlashSale(cart, entitlementService, flashScheduleService, promotionService)
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
