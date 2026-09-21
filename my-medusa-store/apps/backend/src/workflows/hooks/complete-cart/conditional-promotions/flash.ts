import { PromotionEntitlementModuleService } from "@/src/modules/promotion-entitlement"
import { throwInvalidPromotion } from "../../shared/errors"
import { isFlashWindow } from "../../shared/cart-promotion-utils"

export async function validateFlashPromotion(
    cart: any,
    entitlementService: PromotionEntitlementModuleService,
) {
    const [redemption] = await entitlementService.listFlashRedemptions({ cart_id: cart.id })
    if (!cart.customer?.id || !isFlashWindow() || !redemption || redemption.state !== "reserved") {
        throwInvalidPromotion("Flash Promotion không còn hiệu lực cho giỏ hàng này")
    }
}
