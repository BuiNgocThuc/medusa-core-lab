import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { MedusaContainer } from "@medusajs/framework/types"

/**
 * Helper function (plain async) — dùng trực tiếp trong hook handler.
 *
 * BẢO ĐẢM BẤT BIẾN: 1 customer chỉ có tối đa 1 active cart trên mỗi sales channel.
 * Storefront khi nhận ACTIVE_CART_ALREADY_EXISTS nên gọi
 * /store/carts/restore-customer thay vì tạo giỏ mới.
 */
export async function validateActiveCart(
  {
    customer_id,
    sales_channel_id,
  }: {
    customer_id: string | null | undefined
    sales_channel_id: string | null | undefined
  },
  container: MedusaContainer
): Promise<void> {
  // Guest checkout → Bỏ qua
  if (!customer_id) return

  // Không có sales_channel_id → Bỏ qua, workflow chuẩn xử lý
  if (!sales_channel_id) return

  const query = container.resolve<any>(ContainerRegistrationKeys.QUERY)

  const { data: existingCarts } = await query.graph({
    entity: "cart",
    fields: ["id", "sales_channel_id"],
    filters: {
      customer_id,
      sales_channel_id,
      completed_at: null,
    },
  })

  if (existingCarts && existingCarts.length > 0) {
    const activeCartId = existingCarts[0].id
    console.warn(
      `[Hook: validate-cart-creation] Chặn customer ${customer_id} tạo thêm cart mới trong sales channel ${sales_channel_id}. Đã có active cart: ${activeCartId}`
    )
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Customer already has an active cart (${activeCartId}) in this sales channel. Please use the existing cart or call /store/carts/restore-customer.`,
      "ACTIVE_CART_ALREADY_EXISTS"
    )
  }
}
