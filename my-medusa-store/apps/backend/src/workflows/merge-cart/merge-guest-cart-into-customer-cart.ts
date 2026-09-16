import {
  createWorkflow,
  transform,
  when,
  WorkflowData,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  releaseLockStep,
  transferCartCustomerWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { MergeGuestCartInput } from "./types"

export const mergeGuestCartIntoCustomerCartWorkflow = createWorkflow(
  "merge-guest-cart-into-customer-cart",
  (input: WorkflowData<MergeGuestCartInput>) => {
    // =========================================================================
    // BƯỚC 1: Tìm giỏ hàng hiện có của khách hàng (Cart A)
    // Tận dụng useQueryGraphStep có sẵn của Medusa Core để query entity 'cart'
    // =========================================================================
    const cartQuery = useQueryGraphStep({
      entity: "cart",
      filters: { customer_id: input.customer_id },
      fields: [
        "id",
        "email",
        "customer_id",
        "completed_at",
        "currency_code",
        "region_id",
        "sales_channel_id",
      ],
    }).config({ name: "get-customer-cart" })

    // =========================================================================
    // BƯỚC 2: Xác định Active Cart
    // Giỏ hàng active là giỏ hàng chưa hoàn thành thanh toán (completed_at === null)
    // =========================================================================
    const customerCart = transform({ cartQuery }, ({ cartQuery }) => {
      const activeCart = cartQuery.data?.find((cart) => !cart.completed_at)
      return activeCart ?? null
    })

    // =========================================================================
    // BƯỚC 3 (NHÁNH 1): Nếu khách hàng CHƯA có giỏ hàng (customerCart === null)
    // -> Chuyển quyền sở hữu Cart B cho khách hàng (Transfer Path)
    // -> Tận dụng transferCartCustomerWorkflow có sẵn của Medusa Core
    // =========================================================================
    when("no-customer-cart", { customerCart }, ({ customerCart }) => {
      return customerCart === null
    }).then(() => {
      // Khóa phân tán trên Cart B để tránh race condition khi đăng nhập song song
      acquireLockStep({
        key: input.guest_cart_id,
        timeout: 30,
        ttl: 120,
      })

      // Gọi workflow chuyển đổi customer có sẵn từ Core
      transferCartCustomerWorkflow.runAsStep({
        input: {
          id: input.guest_cart_id,
          customer_id: input.customer_id,
        },
      })

      // Giải phóng khóa sau khi hoàn tất
      releaseLockStep({ key: input.guest_cart_id })
    })

    // =========================================================================
    // BƯỚC 4 (NHÁNH 2): Nếu khách hàng ĐÃ có giỏ hàng (customerCart !== null)
    // -> Gộp các sản phẩm hợp lệ từ Cart B vào Cart A (Merge Path)
    // =========================================================================
    when("has-customer-cart", { customerCart }, ({ customerCart }) => {
      return customerCart !== null
    }).then(() => {
      // Vùng để học và viết tiếp logic merge các line items từng bước
    })

    return new WorkflowResponse({})
  }
)