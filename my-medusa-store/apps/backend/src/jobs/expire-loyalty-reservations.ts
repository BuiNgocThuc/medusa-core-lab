import { MedusaContainer } from "@medusajs/framework/types"
import { LOYALTY_MODULE, LoyaltyModuleService } from "@/src/modules/loyalty"
import { Modules } from "@medusajs/framework/utils"

export default async function expireLoyaltyReservations(container: MedusaContainer) {
    const loyalty = container.resolve(LOYALTY_MODULE) as LoyaltyModuleService
    const locking = container.resolve(Modules.LOCKING) as any
    const cartModule = container.resolve(Modules.CART) as any
    const promotionModule = container.resolve(Modules.PROMOTION) as any
    const reservations = await loyalty.listLoyaltyReservations({ state: "reserved" })
    const now = new Date()
    for (const reservation of reservations) {
        if (reservation.expires_at > now) continue
        const key = `loyalty-customer-${reservation.customer_id}`
        await locking.acquire(key, { expire: 30 })
        try {
            const [current] = await loyalty.listLoyaltyReservations({ id: reservation.id })
            if (!current || current.state !== "reserved" || current.expires_at > new Date()) continue
            await loyalty.releaseReservation(current.cart_id, "expired")
            await promotionModule.updatePromotions(current.promotion_id, { status: "inactive" })
            const [cart] = await cartModule.listCarts({ id: current.cart_id })
            if (cart) {
                const { loyalty_promo_id, ...metadata } = cart.metadata || {}
                await cartModule.updateCarts({ id: cart.id, metadata })
            }
        } finally {
            await locking.release(key)
        }
    }
}

export const config = {
    name: "expire-loyalty-reservations",
    schedule: "*/5 * * * *",
}
