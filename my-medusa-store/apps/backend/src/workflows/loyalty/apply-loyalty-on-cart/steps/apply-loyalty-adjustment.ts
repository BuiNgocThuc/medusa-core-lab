import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { LOYALTY_REDEEM_VND_PER_POINT } from "@/src/constant"

const LOYALTY_ADJUSTMENT_CODE_PREFIX = "LOYALTY-ADJUSTMENT-"

type ApplyLoyaltyAdjustmentInput = {
  cart_id: string
  promotion_id: string
  points: number
}

export const applyLoyaltyAdjustmentStep = createStep(
  "apply-loyalty-adjustment",
  async (input: ApplyLoyaltyAdjustmentInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
    const cartModule = container.resolve(Modules.CART) as any
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "items.id",
        "items.subtotal",
        "items.unit_price",
        "items.quantity",
        "items.adjustments.id",
        "items.adjustments.amount",
        "items.adjustments.code",
        "items.adjustments.promotion_id",
      ],
      filters: { id: input.cart_id },
    })
    const cart = carts[0]
    if (!cart) return new StepResponse([])

    const adjustmentCode = `${LOYALTY_ADJUSTMENT_CODE_PREFIX}${input.cart_id}`
    const existingLoyaltyAdjustments = (cart.items ?? []).flatMap((item: any) =>
      (item.adjustments ?? []).filter((adjustment: any) =>
        adjustment.promotion_id === input.promotion_id || adjustment.code === adjustmentCode,
      ),
    )

    const items = (cart.items ?? []).map((item: any) => {
      const otherDiscounts = (item.adjustments ?? [])
        .filter((adjustment: any) =>
          adjustment.promotion_id !== input.promotion_id && adjustment.code !== adjustmentCode,
        )
        .reduce((total: number, adjustment: any) => total + Number(adjustment.amount ?? 0), 0)

      const subtotal = Number(
        item.subtotal ?? Number(item.unit_price ?? 0) * Number(item.quantity ?? 0),
      )

      return {
        id: item.id,
        remaining: Math.max(0, subtotal - otherDiscounts),
      }
    }).filter((item: { remaining: number }) => item.remaining > 0)

    const availableTotal = items.reduce(
      (total: number, item: { remaining: number }) => total + item.remaining,
      0,
    )
    const loyaltyDiscount = Math.min(
      input.points * LOYALTY_REDEEM_VND_PER_POINT,
      availableTotal,
    )
    const promotionAdjustments = existingLoyaltyAdjustments.filter(
      (adjustment: any) => adjustment.promotion_id === input.promotion_id,
    )
    const customAdjustmentTotal = existingLoyaltyAdjustments
      .filter((adjustment: any) => adjustment.code === adjustmentCode)
      .reduce((total: number, adjustment: any) => total + Number(adjustment.amount ?? 0), 0)

    if (!promotionAdjustments.length && customAdjustmentTotal === loyaltyDiscount) {
      return new StepResponse([])
    }

    if (existingLoyaltyAdjustments.length) {
      await cartModule.softDeleteLineItemAdjustments(
        existingLoyaltyAdjustments.map((adjustment: any) => adjustment.id),
      )
    }

    let allocatedDiscount = 0

    const adjustments = items.map((item: { id: string; remaining: number }, index: number) => {
      const amount = index === items.length - 1
        ? loyaltyDiscount - allocatedDiscount
        : Math.min(item.remaining, Math.floor(loyaltyDiscount * item.remaining / availableTotal))
      allocatedDiscount += amount

      return {
        item_id: item.id,
        code: adjustmentCode,
        amount,
      }
    }).filter((adjustment: { amount: number }) => adjustment.amount > 0)

    if (adjustments.length) {
      await cartModule.addLineItemAdjustments(adjustments)
    }

    return new StepResponse(existingLoyaltyAdjustments)
  },
)
