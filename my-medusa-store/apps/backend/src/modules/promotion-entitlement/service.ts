import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import { FirstPurchaseEntitlement } from "./models"

class PromotionEntitlementModuleService extends MedusaService({
    FirstPurchaseEntitlement,
}) {
    async reserveFirstPurchase(customerId: string, cartId: string) {
        const [existing] = await this.listFirstPurchaseEntitlements({ customer_id: customerId })

        if (!existing) {
            return await this.createFirstPurchaseEntitlements({
                customer_id: customerId,
                state: "reserved",
                cart_id: cartId,
                reserved_at: new Date(),
            })
        }

        if (existing.state === "consumed") {
            throw new MedusaError(
                MedusaError.Types.NOT_ALLOWED,
                "Ưu đãi đơn đầu đã được sử dụng",
            )
        }

        if (existing.state === "reserved" && existing.cart_id !== cartId) {
            throw new MedusaError(
                MedusaError.Types.CONFLICT,
                "Ưu đãi đơn đầu đang được giữ ở giỏ hàng khác",
            )
        }

        return await this.updateFirstPurchaseEntitlements({
            id: existing.id,
            state: "reserved",
            cart_id: cartId,
            reserved_at: new Date(),
        })
    }

    async consumeFirstPurchase(customerId: string, cartId: string, orderId: string) {
        const [existing] = await this.listFirstPurchaseEntitlements({ customer_id: customerId })

        if (!existing || existing.state !== "reserved" || existing.cart_id !== cartId) {
            throw new MedusaError(
                MedusaError.Types.NOT_ALLOWED,
                "Ưu đãi đơn đầu không hợp lệ cho giỏ hàng này",
            )
        }

        return await this.updateFirstPurchaseEntitlements({
            id: existing.id,
            state: "consumed",
            order_id: orderId,
            consumed_at: new Date(),
        })
    }

    async releaseFirstPurchase(cartId: string) {
        const [existing] = await this.listFirstPurchaseEntitlements({ cart_id: cartId })

        if (!existing || existing.state !== "reserved") {
            return existing
        }

        return await this.updateFirstPurchaseEntitlements({
            id: existing.id,
            state: "available",
            cart_id: null,
            reserved_at: null,
        })
    }
}

export default PromotionEntitlementModuleService
