// src/api/store/carts/[id]/merge-customer/route.ts
import { mergeGuestCartIntoCustomerCartWorkflow } from "@/src/workflows/merge-cart/merge-guest-cart-into-customer-cart"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MergeGuestCartOutput } from "@/src/workflows/merge-cart/types"





//src/api/store/carts/[id]/merge-customer/route.ts
/**
 * Gộp giỏ hàng vãng lai (Guest Cart) vào giỏ hàng của Customer sau khi đăng nhập.
 *
 * Luồng nghiệp vụ:
 * - Kịch bản 1: Nếu Customer chưa có giỏ hàng cũ -> Chuyển quyền sở hữu Guest Cart cho Customer.
 * - Kịch bản 2: Nếu Customer đã có giỏ hàng cũ -> Validate tồn kho, gộp các item hợp lệ vào
 *   giỏ hàng cũ và xóa Guest Cart.
 *
 * @param req - AuthenticatedMedusaRequest chứa:
 *   - `params.id`: ID của giỏ hàng guest (`guest_cart_id`).
 *   - `auth_context.actor_id`: ID của khách hàng đã đăng nhập (`customer_id`).
 *   - `publishable_key_context`: Chứa sales channel ID tương ứng.
 *   - `validatedBody.additional_data`: (Tùy chọn) Dữ liệu bổ sung nếu có.
 * @param res - MedusaResponse<MergeGuestCartOutput> dùng để phản hồi kết quả về client.
 * 
 * @returns Trả về HTTP 200 kèm JSON:
 *   - `cart.id`: ID của giỏ hàng active cuối cùng của customer sau khi gộp.
 *   - `skipped_items`: Danh sách các mặt hàng bị bỏ qua (ví dụ do hết hàng tồn kho).
 */

export async function POST(
  req: AuthenticatedMedusaRequest<{ additional_data?: Record<string, unknown> }>,
  res: MedusaResponse<MergeGuestCartOutput>
) {
  const guest_cart_id = req.params.id
  const customer_id = req.auth_context?.actor_id
  const sales_channel_id = (req as any).publishable_key_context.sales_channel_ids[0]

  const { result } = await mergeGuestCartIntoCustomerCartWorkflow(req.scope).run({
    input: {
      guest_cart_id,
      customer_id,
      sales_channel_id,
      additional_data: req.validatedBody?.additional_data,
    },
  })

  return res.json(result)
}