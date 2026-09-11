import { completeCartWorkflow, updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
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
  if (!input.promo_codes?.some((code) => code === FIRST_PURCHASE_PROMOTION_CODE)) return
  await validateFirstPurchase(cart, container)
})

completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  if (!cart.promotions?.some((promo) => promo?.code === FIRST_PURCHASE_PROMOTION_CODE)) return
  await validateFirstPurchase(cart, container)
})
