import {
  updateCartWorkflow,
  calculateShippingOptionsPricesWorkflow,
} from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Hàm đồng bộ số tiền của phương thức vận chuyển có `price_type === 'calculated'` (như GHN).
 * 
 * Mỗi khi giỏ hàng có sự thay đổi (Apply/Remove coupon, đổi địa chỉ, thay đổi sản phẩm):
 * 1. Kiểm tra xem giỏ hàng đã có shipping_method chưa.
 * 2. Lọc ra các method có `price_type === 'calculated'`.
 * 3. Chạy `calculateShippingOptionsPricesWorkflow` để tính lại giá cước thực tế từ Provider (GHN).
 * 4. Nếu giá mới khác giá đang lưu trong DB, cập nhật lại `cart_shipping_method.amount`.
 * 
 * Nhờ đó:
 * - Cột `Delivery` (real-time preview) và cột `In your Cart` (lưu trong DB) luôn bằng nhau 100%.
 * - Các phương thức giá cố định (flat_rate 30k, 60k) hoàn toàn không bị ảnh hưởng.
 */
export async function syncCalculatedShippingForCart(cartId: string, container: any) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any

  try {
    const { data: [cart] } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "shipping_methods.id",
        "shipping_methods.name",
        "shipping_methods.amount",
        "shipping_methods.shipping_option_id",
        "shipping_methods.data",
        "shipping_methods.shipping_option.id",
        "shipping_methods.shipping_option.price_type",
      ],
      filters: { id: cartId },
    })

    if (!cart?.shipping_methods?.length) {
      return
    }

    const calculatedMethods = cart.shipping_methods.filter(
      (sm: any) => sm.shipping_option?.price_type === "calculated"
    )

    if (!calculatedMethods.length) {
      return
    }

    // Tính lại giá cho các phương thức calculated
    const { result: calculatedPrices } = await calculateShippingOptionsPricesWorkflow(container).run({
      input: {
        cart_id: cart.id,
        shipping_options: calculatedMethods.map((sm: any) => ({
          id: sm.shipping_option_id,
          data: sm.data ?? {},
        })),
      },
    })

    if (!calculatedPrices?.length) {
      return
    }

    const cartService = container.resolve(Modules.CART) as any
    const updates: { id: string; amount: number }[] = []

    for (let i = 0; i < calculatedMethods.length; i++) {
      const method = calculatedMethods[i]
      const priceResult = calculatedPrices[i]
      const newAmount = priceResult?.calculated_amount

      if (newAmount !== undefined && Number(newAmount) !== Number(method.amount)) {
        logger?.info?.(
          `[Sync Calculated Shipping] Cart ${cart.id}: Syncing shipping method "${method.name}" (${method.id}) amount: ${method.amount} -> ${newAmount}`
        )
        updates.push({
          id: method.id,
          amount: Number(newAmount),
        })
      }
    }

    if (updates.length > 0) {
      await cartService.updateShippingMethods(updates)
    }
  } catch (err: any) {
    logger?.warn?.(
      `[Sync Calculated Shipping] Failed to sync shipping price for cart ${cartId}: ${err.message}`
    )
  }
}

/**
 * Đăng ký Hook `cartUpdated` trong `updateCartWorkflow`.
 * Chạy đồng bộ trong mọi request cập nhật giỏ hàng (Apply/Remove coupon, cập nhật thông tin).
 */
updateCartWorkflow.hooks.cartUpdated(
  async ({ cart }, { container }) => {
    if (!cart?.id) return
    await syncCalculatedShippingForCart(cart.id, container)
  }
)
