import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"

/**
 * Step xóa giỏ hàng (Cart B) sau khi đã gộp thành công vào Cart A.
 * - Tránh việc một tài khoản tồn tại song song 2 giỏ hàng active trong database.
 * - Hỗ trợ compensation: nếu workflow rollback, giỏ hàng sẽ được khôi phục lại.
 */
export const deleteCartStep = createStep(
  "delete-cart",
  async (input: { cart_id: string }, { container }) => {
    console.log(`[Step: delete-cart-step] Deleting guest cart: ${input.cart_id}`)
    const cartService = container.resolve<any>(Modules.CART)
    await cartService.deleteCarts([input.cart_id])
    return new StepResponse({ id: input.cart_id }, input.cart_id)
  },
  async (cartId, { container }) => {
    if (cartId) {
      console.log(`[Step: delete-cart-step] Compensating - restoring cart: ${cartId}`)
      const cartService = container.resolve<any>(Modules.CART)
      if (typeof cartService.restoreCarts === "function") {
        await cartService.restoreCarts([cartId])
      }
    }
  }
)
