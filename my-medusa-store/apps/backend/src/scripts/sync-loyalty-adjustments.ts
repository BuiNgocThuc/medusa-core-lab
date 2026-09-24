import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, PromotionActions } from "@medusajs/framework/utils"
import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { LOYALTY_MODULE, LoyaltyModuleService } from "@/src/modules/loyalty"
import { syncLoyaltyAdjustmentWorkflow } from "@/src/workflows"

export default async function syncLoyaltyAdjustments({ container }: ExecArgs) {
  const loyalty = container.resolve(LOYALTY_MODULE) as LoyaltyModuleService
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const link = container.resolve(ContainerRegistrationKeys.LINK) as any
  const reservations = await loyalty.listLoyaltyReservations({ state: "reserved" })

  for (const reservation of reservations) {
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: ["id", "promotions.id", "promotions.code"],
      filters: { id: reservation.cart_id },
    })
    const cart = carts[0]
    const promotionCodes = (cart?.promotions ?? [])
      .filter((promotion: any) => promotion.id !== reservation.promotion_id)
      .map((promotion: any) => promotion.code)

    await updateCartPromotionsWorkflow(container).run({
      input: {
        cart_id: reservation.cart_id,
        promo_codes: promotionCodes,
        action: PromotionActions.REPLACE,
      },
    })
    await link.create([{
      [Modules.CART]: { cart_id: reservation.cart_id },
      [Modules.PROMOTION]: { promotion_id: reservation.promotion_id },
    }])

    await syncLoyaltyAdjustmentWorkflow(container).run({
      input: {
        cart_id: reservation.cart_id,
        promotion_id: reservation.promotion_id,
        points: reservation.points,
      },
    })
  }
}
