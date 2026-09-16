// src/api/store/carts/[id]/merge-customer/route.ts
import { mergeGuestCartIntoCustomerCartWorkflow } from "@/src/workflows/merge-cart/merge-guest-cart-into-customer-cart"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"


type MergeCartResponse = {
  cart: { id: string }
}


export async function POST(
  req: AuthenticatedMedusaRequest<{ additional_data?: Record<string, unknown> }>,
  res: MedusaResponse<MergeCartResponse>
) {
  const guest_cart_id = req.params.id
  const customer_id = req.auth_context?.actor_id
  // Gọi trực tiếp workflow với Type-Safe của Medusa v2
  const { result } = await mergeGuestCartIntoCustomerCartWorkflow(req.scope).run({
    input: {
      guest_cart_id,
      customer_id,
      additional_data: req.validatedBody?.additional_data,
    },
  })
  return res.status(200).json({
    cart: { id: result.cart_id },
  })
}