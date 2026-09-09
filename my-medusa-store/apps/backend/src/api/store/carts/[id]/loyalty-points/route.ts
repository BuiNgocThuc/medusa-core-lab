import { randomUUID } from "crypto"
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError, Modules, PromotionActions } from "@medusajs/framework/utils"
import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import {
  LOYALTY_PROMOTION_PREFIX,
  LOYALTY_REDEMPTION_POINTS,
  LOYALTY_REDEMPTION_VALUE,
} from "../../../../../constants"
import { LOYALTY_MODULE } from "../../../../../modules/loyalty"

type RedeemPointsBody = {
  points: number
}

export async function POST(
  req: AuthenticatedMedusaRequest<RedeemPointsBody>,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id
  const { points } = req.validatedBody

  if (!Number.isInteger(points) || points < LOYALTY_REDEMPTION_POINTS || points % LOYALTY_REDEMPTION_POINTS) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Points must be a multiple of ${LOYALTY_REDEMPTION_POINTS}`
    )
  }

  const cartModule = req.scope.resolve(Modules.CART) as any
  const [cart] = await cartModule.listCarts({ id: req.params.id })
  if (!cart || cart.customer_id !== customerId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found")
  }

  const loyaltyModule = req.scope.resolve(LOYALTY_MODULE) as any
  const [account] = await loyaltyModule.listLoyaltyAccounts({ customer_id: customerId })
  if (!account || account.balance < points) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Insufficient loyalty points")
  }

  const promotionModule = req.scope.resolve(Modules.PROMOTION) as any
  const code = `${LOYALTY_PROMOTION_PREFIX}-${points}-${randomUUID()}`
  const [promotion] = await promotionModule.createPromotions({
    code,
    type: "standard",
    status: "active",
    application_method: {
      type: "fixed",
      target_type: "items",
      allocation: "across",
      value: (points / LOYALTY_REDEMPTION_POINTS) * LOYALTY_REDEMPTION_VALUE,
      currency_code: "vnd",
    },
    rules: [{ attribute: "customer_id", operator: "eq", values: [customerId] }],
  })

  await updateCartPromotionsWorkflow(req.scope).run({
    input: {
      cart_id: cart.id,
      promo_codes: [code],
      action: PromotionActions.ADD,
    },
  })

  res.status(201).json({ promotion, redeemed_points: points })
}
