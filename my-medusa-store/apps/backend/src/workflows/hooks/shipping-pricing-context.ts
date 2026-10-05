import { calculateShippingOptionsPricesWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse } from "@medusajs/framework/workflows-sdk"

/**
 * Hook `setCalculatedShippingPricingContext` trong `calculateShippingOptionsPricesWorkflow`.
 * 
 * Mục đích:
 * Tự động truy vấn giá trị giỏ hàng thực tế (item_total, subtotal, discount_total, total) 
 * thông qua Remote Query Graph (tầng Workflows có quyền truy cập root container)
 * và đưa vào `context` của Fulfillment Provider (như GiaoHangNhanhProviderService).
 * 
 * Nhờ đó, Provider có thể tính đúng phí khai giá bảo hiểm (insurance_value)
 * dựa trên giá trị sau khi đã áp dụng mã khuyến mãi (promotions) mà không cần dùng Knex query thô.
 */
calculateShippingOptionsPricesWorkflow.hooks.setCalculatedShippingPricingContext(
  async ({ input }, { container }) => {
    if (!input?.cart_id) {
      return new StepResponse({})
    }

    try {
      const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
      const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any

      const { data: [cart] } = await query.graph({
        entity: "cart",
        fields: [
          "id",
          "currency_code",
          "subtotal",
          "discount_total",
          "item_total",
          "total",
        ],
        filters: { id: input.cart_id },
      })

      if (!cart) {
        return new StepResponse({})
      }

      logger?.info?.(
        `[Hook setCalculatedShippingPricingContext] Injected pricing context for cart ${cart.id}: item_total=${cart.item_total}, discount_total=${cart.discount_total}, total=${cart.total}`
      )

      return new StepResponse({
        item_total: cart.item_total,
        subtotal: cart.subtotal,
        discount_total: cart.discount_total,
        total: cart.total,
      })
    } catch (err: any) {
      const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
      logger?.warn?.(
        `[Hook setCalculatedShippingPricingContext] Failed to query cart pricing context: ${err.message}`
      )
      return new StepResponse({})
    }
  }
)
