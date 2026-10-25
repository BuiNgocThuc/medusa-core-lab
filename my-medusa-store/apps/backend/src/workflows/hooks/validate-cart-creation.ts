import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import { validateActiveCart } from "./helpers/validate-active-cart"

/**
 * Hook validate cho createCartWorkflow.
 * Logic nghiệp vụ nằm trong `./helpers/validate-active-cart.ts`.
 */
createCartWorkflow.hooks.validate(
  async ({ input, cart }, { container }) => {
    await validateActiveCart(
      {
        customer_id: cart?.customer_id,
        sales_channel_id: cart?.sales_channel_id,
      },
      container
    )
  }
)
