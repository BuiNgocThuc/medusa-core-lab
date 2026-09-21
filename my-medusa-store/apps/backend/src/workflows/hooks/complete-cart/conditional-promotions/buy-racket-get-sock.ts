import { throwInvalidPromotion } from "../../shared/errors"
import { quantityForCategory } from "../../shared/cart-promotion-utils"

export function validateBuyRacketGetSock(cart: any) {
    const items = cart.items ?? []
    const hasSummerRacket = items.some((item: any) =>
        (item.variant?.product?.product_categories ?? []).some((entry: any) => entry.name === "Rackets") &&
        item.variant?.product?.collection?.handle === "summer",
    )
    const valid = quantityForCategory(items, "Rackets") >= 2 &&
        hasSummerRacket &&
        quantityForCategory(items, "Socks") >= 1
    if (!valid) throwInvalidPromotion("Buy Racket Get Sock không còn đủ điều kiện")
}
