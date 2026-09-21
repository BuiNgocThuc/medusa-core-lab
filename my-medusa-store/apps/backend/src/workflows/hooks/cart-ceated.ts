import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import { onCartCreatedWorkflow } from "../on-cart-created"

/**
 * Hook handler cho `createCartWorkflow.hooks.cartCreated`.
 *
 * Delegate toàn bộ logic sang `onCartCreatedWorkflow` để đảm bảo:
 * - Compensation tự động nếu một step thất bại (atomicity)
 * - Dễ test và mở rộng thêm steps về sau
 */
createCartWorkflow.hooks.cartCreated(
  async ({ cart, additional_data }, { container }) => {
    await onCartCreatedWorkflow(container).run({
      input: {
        cart_id: cart.id,
        custom_name: additional_data?.custom_name as string | undefined,
      },
    })
  }
)