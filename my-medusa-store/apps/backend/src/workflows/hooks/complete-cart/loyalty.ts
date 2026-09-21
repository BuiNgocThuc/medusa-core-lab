import { MedusaError } from "@medusajs/framework/utils"
import { CartData, getCartLoyaltyPromotion } from "@/src/utils"
import { LoyaltyModuleService } from "@/src/modules/loyalty"
import { Query } from "../shared/types"

export async function validateLoyaltyPoints(
    query: Query,
    cartId: string,
    loyaltyModuleService: LoyaltyModuleService,
) {
    const { data: carts } = await query.graph(
        {
            entity: "cart",
            fields: [
                "id", "promotions.*", "customer.*", "promotions.rules.*",
                "promotions.rules.values.*", "promotions.application_method.*", "metadata",
            ],
            filters: { id: cartId },
        },
        { throwIfKeyNotFound: true },
    )
    const cart = carts[0] as unknown as CartData
    const loyaltyPromotion = getCartLoyaltyPromotion(cart)
    if (!loyaltyPromotion) return

    const requiredPoints = await loyaltyModuleService.calculatePointsFromDiscountAmount(
        loyaltyPromotion.application_method!.value as number,
    )
    const [reservation] = await loyaltyModuleService.listLoyaltyReservations({
        cart_id: cartId,
    })
    if (
        !reservation ||
        reservation.state !== "reserved" ||
        reservation.expires_at <= new Date() ||
        reservation.customer_id !== cart.customer!.id ||
        reservation.promotion_id !== loyaltyPromotion.id ||
        reservation.points !== requiredPoints
    ) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Loyalty points reservation expired, please apply again",
        )
    }
}
