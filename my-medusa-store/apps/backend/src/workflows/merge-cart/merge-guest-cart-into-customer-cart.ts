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
    const customerCart = useQueryGraphStep({
      entity: "cart",
      filters: {
        customer_id: input.customer_id,
        completed_at: null,
      },
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
    const customerCartTransform = transform({ customerCart }, ({ customerCart }) => {
      return customerCart.data?.
    })

    // =========================================================================
    // BƯỚC 3 (NHÁNH 1): Khách CHƯA có Cart A và CÓ guest_cart_id
    // -> Chuyển quyền sở hữu Cart B cho khách hàng (Transfer Path)
    // =========================================================================
    when("transfer-guest-cart", { customerCartTransform, input }, ({ customerCartTransform, input }) => {
      return customerCartTransform === null && !!input.guest_cart_id
    }).then(() => {
      acquireLockStep({
        key: input.guest_cart_id!,
        timeout: 30,
        ttl: 120,
      })

      transferCartCustomerWorkflow.runAsStep({
        input: {
          id: input.guest_cart_id!,
          customer_id: input.customer_id,
        },
      })

      releaseLockStep({ key: input.guest_cart_id! })
    })

    // =========================================================================
    // BƯỚC 4 (NHÁNH 2): Nếu khách hàng ĐÃ có giỏ hàng (customerCart !== null)
    // -> Gộp các sản phẩm hợp lệ từ Cart B vào Cart A (Merge Path)
    // =========================================================================
    when("has-customer-cart", { customerCartTransform }, ({ customerCartTransform }) => {
      return customerCartTransform !== null
    }).then(() => {
      // Vùng để học và viết tiếp logic merge các line items từng bước
    })
    const result = transform(
      { customerCartTransform, input },
      ({ customerCartTransform, input }) => {
        return {
          cart_id: customerCartTransform ? customerCartTransform.id : input.guest_cart_id,
        }
      }
    )
    return new WorkflowResponse(result)
  }
)