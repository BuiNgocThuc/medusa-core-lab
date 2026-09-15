import {
  completeCartWorkflow,
  updateCartPromotionsWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  ContainerRegistrationKeys,
  MedusaError,
  PromotionActions,
} from "@medusajs/framework/utils"
import { FIRST_PURCHASE_PROMOTION_CODE } from "../../constants"

async function validateFirstPurchase(cart: { customer_id?: string | null }, container: any) {
  if (!cart.customer_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "First purchase discount can only be applied to carts with a customer")
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: [customer] } = await query.graph({
    entity: "customer",
    fields: ["orders.*", "has_account"],
    filters: { id: cart.customer_id },
  })
  if (!customer.has_account || (customer?.orders?.length || 0) > 0) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "First purchase discount can only be applied to carts with no previous orders")
  }
}

updateCartPromotionsWorkflow.hooks.validate(async ({ input, cart }, { container }) => {
  // Validation 1: first-purchase discount
  const hasFirstPurchasePromo = input.promo_codes?.some(
    (code) => code === FIRST_PURCHASE_PROMOTION_CODE
  )
  if (hasFirstPurchasePromo) {
    await validateFirstPurchase(cart, container)
  }

  // Validation 2: customer-tier promotion
  if (
    input.action !== PromotionActions.ADD &&
    input.action !== PromotionActions.REPLACE ||
    !input.promo_codes ||
    input.promo_codes.length === 0
  ) {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const customerData = cart.customer_id
    ? await query.graph({
        entity: "customer",
        fields: ["id", "tier.*"],
        filters: { id: cart.customer_id },
      })
    : null
  const customerTier = customerData?.data?.[0]?.tier
  const { data: promotions } = await query.graph({
    entity: "promotion",
    fields: ["id", "code"],
    filters: { code: input.promo_codes },
  })
  const { data: tiers } = await query.graph({
    entity: "tier",
    fields: ["id", "promo_id"],
    filters: { promo_id: promotions.map((promotion) => promotion.id) },
  })

  for (const promotion of promotions) {
    const tierId = tiers.find((tier) => tier.promo_id === promotion.id)?.id
    if (tierId && customerTier?.id !== tierId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Promotion ${promotion.code || promotion.id} can only be applied by customers in the corresponding tier.`
      )
    }
  }
})

completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  // Validation 1: first-purchase discount
  const hasFirstPurchasePromo = cart.promotions?.some(
    (promo) => promo?.code === FIRST_PURCHASE_PROMOTION_CODE
  )
  if (hasFirstPurchasePromo) {
    await validateFirstPurchase(cart, container)
  }

  // Validation 2: customer-tier promotion
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: detailedCarts } = await query.graph({
    entity: "cart",
    fields: ["id", "promotions.*", "customer.id", "customer.tier.*"],
    filters: { id: cart.id },
  }, { throwIfKeyNotFound: true })
  const detailedCart = detailedCarts[0]

  if (!detailedCart?.promotions?.length) {
    return
  }

  const { data: tiers } = await query.graph({
    entity: "tier",
    fields: ["id", "promo_id"],
    filters: {
      promo_id: detailedCart.promotions
        .flatMap((promotion) => promotion?.id ? [promotion.id] : []),
    },
  })

  for (const promotion of detailedCart.promotions) {
    const tierId = tiers.find((tier) => tier.promo_id === promotion?.id)?.id
    if (tierId && detailedCart.customer?.tier?.id !== tierId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Promotion ${promotion?.code || promotion?.id} can only be applied by customers in the corresponding tier.`
      )
    }
  }
})
