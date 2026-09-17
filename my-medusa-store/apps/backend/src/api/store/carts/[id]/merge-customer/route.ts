// src/api/store/carts/[id]/merge-customer/route.ts
import { mergeGuestCartIntoCustomerCartWorkflow } from "@/src/workflows/merge-cart/merge-guest-cart-into-customer-cart"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SkippedCartItem } from "@/src/workflows/merge-cart/types"

type MergeCartResponse = {
  cart: { id: string }
  skipped_items: SkippedCartItem[]
}

export async function POST(
  req: AuthenticatedMedusaRequest<{ additional_data?: Record<string, unknown> }>,
  res: MedusaResponse<MergeCartResponse>
) {
  const guest_cart_id = req.params.id
  const customer_id = req.auth_context?.actor_id

  const { result } = await mergeGuestCartIntoCustomerCartWorkflow(req.scope).run({
    input: {
      guest_cart_id,
      customer_id,
      additional_data: req.validatedBody?.additional_data,
    },
  })

  return res.status(200).json({
    cart: { id: result.cart_id },
    skipped_items: result.skipped_items ?? [],
  })
}