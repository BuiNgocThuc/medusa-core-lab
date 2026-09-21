import { VIP_TIER_NAME } from "@/src/constant"
import { throwInvalidPromotion } from "../../shared/errors"
import { isVietnamCart, quantityForCategory } from "../../shared/cart-promotion-utils"

export function validateVipBundle(cart: any) {
    const valid = cart.customer?.tier?.name === VIP_TIER_NAME &&
        isVietnamCart(cart) &&
        Number(cart.subtotal) >= 2_000_000 &&
        quantityForCategory(cart.items ?? [], "Rackets") >= 2 &&
        quantityForCategory(cart.items ?? [], "Shoes") >= 1
    if (!valid) throwInvalidPromotion("VIP Bundle Discount không còn đủ điều kiện")
}
