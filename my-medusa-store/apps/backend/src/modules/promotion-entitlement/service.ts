import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import { FlashRedemption } from "./models"
import { FLASH_CUSTOMER_USAGE_LIMIT } from "@/src/constant"

class PromotionEntitlementModuleService extends MedusaService({ FlashRedemption }) {
    async reserveFlashRedemption(customerId: string, cartId: string, amount: number) {
        const [forCart] = await this.listFlashRedemptions({ cart_id: cartId })
        if (forCart?.state === "consumed") {
            return forCart
        }

        const redemptions = await this.listFlashRedemptions({ customer_id: customerId })
        const active = redemptions.filter((redemption) =>
            redemption.state === "reserved" || redemption.state === "consumed",
        )
        const alreadyReserved = active.some((redemption) => redemption.cart_id === cartId)
        if (!alreadyReserved && active.length >= FLASH_CUSTOMER_USAGE_LIMIT) {
            throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Bạn đã dùng Flash Promotion tối đa 2 lần")
        }

        if (forCart) {
            return await this.updateFlashRedemptions({
                id: forCart.id,
                customer_id: customerId,
                state: "reserved",
                amount,
                reserved_at: new Date(),
            })
        }
        return await this.createFlashRedemptions({
            customer_id: customerId,
            cart_id: cartId,
            state: "reserved",
            amount,
            reserved_at: new Date(),
        })
    }

    async consumeFlashRedemption(cartId: string, orderId: string) {
        const [redemption] = await this.listFlashRedemptions({ cart_id: cartId })
        if (!redemption || redemption.state !== "reserved") {
            throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Flash Promotion không hợp lệ cho giỏ hàng này")
        }
        return await this.updateFlashRedemptions({
            id: redemption.id,
            state: "consumed",
            order_id: orderId,
            consumed_at: new Date(),
        })
    }

    async releaseFlashRedemption(cartId: string) {
        const [redemption] = await this.listFlashRedemptions({ cart_id: cartId })
        if (!redemption || redemption.state !== "reserved") return redemption
        return await this.deleteFlashRedemptions(redemption.id)
    }
}

export default PromotionEntitlementModuleService
