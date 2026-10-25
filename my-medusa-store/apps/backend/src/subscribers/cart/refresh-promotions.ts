import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import {
    addTierPromotionToCartWorkflow,
    refreshConditionalPromotionsWorkflow,
    syncClaimedFlashSale,
    syncLoyaltyAdjustmentWorkflow,
} from "@/workflows"
import { LOYALTY_MODULE, LoyaltyModuleService } from "@/modules/loyalty"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function refreshPromotionsHandler({
    event: { data },
    container,
}: SubscriberArgs<{ id: string }>) {
    await refreshConditionalPromotionsWorkflow(container).run({
        input: { cart_id: data.id },
    })
    await syncClaimedFlashSale(container, data.id)
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
    const { data: carts } = await query.graph({
        entity: "cart",
        fields: ["id", "promotions.id"],
        filters: { id: data.id },
    })
    if (!(carts[0]?.promotions ?? []).length) {
        await addTierPromotionToCartWorkflow(container).run({
            input: { cart_id: data.id },
        })
    }

    const loyalty = container.resolve(LOYALTY_MODULE) as LoyaltyModuleService
    const [reservation] = await loyalty.listLoyaltyReservations({
        cart_id: data.id,
        state: "reserved",
    })
    if (reservation) {
        await loyalty.updateLoyaltyReservations({
            id: reservation.id,
            expires_at: new Date(Date.now() + 30 * 60 * 1000),
        })
        await syncLoyaltyAdjustmentWorkflow(container).run({
            input: {
                cart_id: data.id,
                promotion_id: reservation.promotion_id,
                points: reservation.points,
            },
        })
    }
}

export const config: SubscriberConfig = {
    event: "cart.updated",
}
