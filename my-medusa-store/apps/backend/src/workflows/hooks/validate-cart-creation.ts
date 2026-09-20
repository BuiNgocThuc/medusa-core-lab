import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createCartWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Hook validate cho createCartWorkflow:
 * 
 * BẢO ĐẢM BẤT BIẾN 1 CUSTOMER CHỈ CÓ TỐI ĐA 1 ACTIVE CART TRÊN MỖI SALES CHANNEL.
 * 
 * Khi Storefront hoặc client gọi POST /store/carts:
 * 1. Nếu là Guest (chưa có customer_id): Cho phép tạo bình thường.
 * 2. Nếu đã đăng nhập (có customer_id):
 *    - Query database tìm xem customer này đã có cart nào chưa checkout (completed_at: null)
 *      trong cùng sales_channel_id hay không.
 *    - Nếu ĐÃ CÓ: Chặn ngay lập tức và ném lỗi MedusaError (ACTIVE_CART_ALREADY_EXISTS).
 *    - Storefront khi nhận mã lỗi này nên điều hướng hoặc gọi API /store/carts/restore-customer
 *      để lấy lại cart hiện có thay vì tạo giỏ rác.
 */
createCartWorkflow.hooks.validate(
  async ({ input, cart }, { container }) => {
    // 1. Guest checkout -> Bỏ qua, cho phép tạo giỏ hàng ẩn danh
    if (!cart?.customer_id) {
      return
    }

    // Nếu không có sales_channel_id -> Bỏ qua để workflow xử lý theo luồng chuẩn
    if (!cart?.sales_channel_id) {
      return
    }

    const query = container.resolve<any>(ContainerRegistrationKeys.QUERY)

    // 2. Query tìm active cart của customer trong cùng Sales Channel
    const { data: existingCarts } = await query.graph({
      entity: "cart",
      fields: ["id", "sales_channel_id"],
      filters: {
        customer_id: cart.customer_id,
        sales_channel_id: cart.sales_channel_id,
        completed_at: null,
      },
    })

    // 3. Nếu đã tồn tại giỏ hàng active -> Chặn tạo giỏ mới
    if (existingCarts && existingCarts.length > 0) {
      const activeCartId = existingCarts[0].id
      console.warn(
        `[Hook: validate-cart-creation] Chặn customer ${cart.customer_id} tạo thêm cart mới trong sales channel ${cart.sales_channel_id}. Đã có active cart: ${activeCartId}`
      )
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Customer already has an active cart (${activeCartId}) in this sales channel. Please use the existing cart or call /store/carts/restore-customer.`,
        "ACTIVE_CART_ALREADY_EXISTS"
      )
    }
  }
)
