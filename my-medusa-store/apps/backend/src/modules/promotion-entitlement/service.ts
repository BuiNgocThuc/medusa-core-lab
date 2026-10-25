import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import { FlashRedemption } from "./models"

class PromotionEntitlementModuleService extends MedusaService({ FlashRedemption }) {
    async reserveFlashRedemption(input: {
        customer_id: string
        cart_id: string
        amount: number
        flash_sale_schedule_id: string
        source_promotion_id: string
        campaign_id: string
        carrier_promotion_id?: string | null
        expires_at: Date
        usage_limit: number
    }) {
        const { customer_id: customerId, cart_id: cartId, amount } = input
        const [forCart] = await this.listFlashRedemptions({ cart_id: cartId })
        if (forCart?.state === "consumed") {
            return forCart
        }

        const allScheduleRedemptions = await this.listFlashRedemptions({ flash_sale_schedule_id: input.flash_sale_schedule_id })
        const redemptions = allScheduleRedemptions.filter((redemption) => redemption.customer_id === customerId)
        const now = new Date()
        const active = redemptions.filter((redemption) =>
            redemption.campaign_id === input.campaign_id &&
            (redemption.state === "consumed" ||
                (redemption.state === "reserved" && (!redemption.expires_at || redemption.expires_at > now))),
        )
        const alreadyReserved = active.some((redemption) => redemption.cart_id === cartId)
        if (!alreadyReserved && active.length >= input.usage_limit) {
            throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Bạn đã dùng Flash Promotion tối đa số lượt cho phép")
        }

        if (forCart) {
            return await this.updateFlashRedemptions({
                id: forCart.id,
                customer_id: customerId,
                state: "reserved",
                amount,
                reserved_at: new Date(),
                flash_sale_schedule_id: input.flash_sale_schedule_id,
                source_promotion_id: input.source_promotion_id,
                campaign_id: input.campaign_id,
                carrier_promotion_id: input.carrier_promotion_id ?? null,
                expires_at: input.expires_at,
            })
        }
        return await this.createFlashRedemptions({ ...input, state: "reserved", reserved_at: new Date() })
    }

    async consumeFlashRedemption(cartId: string, orderId: string) {
        const [redemption] = await this.listFlashRedemptions({ cart_id: cartId })
        if (!redemption || redemption.state !== "reserved" || (redemption.expires_at && redemption.expires_at <= new Date())) {
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
