import { updateCartWorkflow } from "@medusajs/medusa/core-flows"
import { validateCartEmail } from "./helpers/validate-cart-email"

/**
 * Hook validate cho updateCartWorkflow.
 * Logic nghiệp vụ nằm trong `./helpers/validate-cart-email.ts`.
 */
updateCartWorkflow.hooks.validate(
  async ({ input, cart }, { container }) => {
    await validateCartEmail(
      {
        email: input?.email,
        cart_id: cart?.id,
        customer_id: cart?.customer_id,
      },
      container
    )
  }
)
