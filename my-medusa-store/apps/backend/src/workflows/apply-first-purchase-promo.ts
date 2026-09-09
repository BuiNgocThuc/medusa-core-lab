import { createWorkflow, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { PromotionActions } from "@medusajs/framework/utils"
import {
  updateCartPromotionsStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { FIRST_PURCHASE_PROMOTION_CODE } from "../constants"

type ApplyFirstPurchasePromoInput = {
  cart_id: string
}

export const applyFirstPurchasePromoWorkflow = createWorkflow(
  "apply-first-purchase-promo",
  (input: ApplyFirstPurchasePromoInput) => {
    const { data: carts } = useQueryGraphStep({
      entity: "cart",
      fields: ["promotions.*", "customer.*", "customer.orders.*"],
      filters: { id: input.cart_id },
    })

    const { data: promotions } = useQueryGraphStep({
      entity: "promotion",
      fields: ["id", "code"],
      filters: { code: FIRST_PURCHASE_PROMOTION_CODE },
    }).config({ name: "retrieve-first-purchase-promotion" })

    when({ carts, promotions }, (data) => {
      const cart = data.carts[0]
      const promotion = data.promotions[0]

      return Boolean(
        cart &&
          promotion &&
          cart.customer &&
          cart.customer.has_account &&
          cart.customer.orders?.length === 0 &&
          !cart.promotions?.some((item) => item?.id === promotion.id)
      )
    }).then(() => {
      updateCartPromotionsStep({
        id: carts[0].id,
        promo_codes: [FIRST_PURCHASE_PROMOTION_CODE],
        action: PromotionActions.ADD,
      })
    })

    return new WorkflowResponse(carts[0])
  }
)
