import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  completeCartWorkflow,
  updateCartPromotionsWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  CUSTOMER_TIERS,
  FIRST_PURCHASE_PROMOTION_CODE,
  LOYALTY_PROMOTION_PREFIX,
  LOYALTY_REDEMPTION_POINTS,
} from "../../constants"
import { LOYALTY_MODULE } from "../../modules/loyalty"

const tierPromotionCodes = new Set(
  ["silver", "gold"].map((tier) => `TIER_${tier.toUpperCase()}`)
)

function loyaltyPointsFromCode(code?: string | null) {
  if (!code?.startsWith(`${LOYALTY_PROMOTION_PREFIX}-`)) {
    return 0
  }

  const points = Number(code.split("-")[1])
  return Number.isInteger(points) && points >= LOYALTY_REDEMPTION_POINTS
    ? points
    : 0
}

async function assertFirstPurchaseEligibility(
  cart: { customer_id?: string | null },
  container: { resolve: (name: string) => any }
) {
  if (!cart.customer_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "First purchase discount requires a signed-in customer"
    )
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["has_account", "orders.id"],
    filters: { id: cart.customer_id },
  })
  const customer = customers[0]

  if (!customer?.has_account || customer.orders?.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "First purchase discount is only valid for a customer's first order"
    )
  }
}

async function assertLoyaltyEligibility(
  cart: { customer_id?: string | null; promotions?: { code?: string | null }[] },
  container: { resolve: (name: string) => any }
) {
  const promotion = cart.promotions?.find((item) =>
    item.code?.startsWith(`${LOYALTY_PROMOTION_PREFIX}-`)
  )
  const points = loyaltyPointsFromCode(promotion?.code)

  if (!promotion || !points || !cart.customer_id) {
    if (promotion) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid loyalty promotion")
    }
    return
  }

  const loyaltyModule = container.resolve(LOYALTY_MODULE) as any
  const [account] = await loyaltyModule.listLoyaltyAccounts({
    customer_id: cart.customer_id,
  })

  if (!account || account.balance < points) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Insufficient loyalty points")
  }
}

updateCartPromotionsWorkflow.hooks.validate(async ({ input, cart }, { container }) => {
  const addsFirstPurchase = input.promo_codes?.includes(FIRST_PURCHASE_PROMOTION_CODE)
  if (addsFirstPurchase) {
    const hasTierPromotion = cart.promotions?.some((promotion) =>
      tierPromotionCodes.has(promotion.code ?? "")
    )
    if (hasTierPromotion) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "WELCOME10 cannot be combined with a tier promotion"
      )
    }
    await assertFirstPurchaseEligibility(cart, container)
  }
})

completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  const hasFirstPurchase = cart.promotions?.some(
    (promotion) => promotion.code === FIRST_PURCHASE_PROMOTION_CODE
  )
  const hasTierPromotion = cart.promotions?.some((promotion) =>
    tierPromotionCodes.has(promotion.code ?? "")
  )

  if (hasFirstPurchase) {
    if (hasTierPromotion) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "WELCOME10 cannot be combined with a tier promotion"
      )
    }
    await assertFirstPurchaseEligibility(cart, container)
  }

  await assertLoyaltyEligibility(cart, container)
})
