import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { claimFlashSaleWorkflow, removeFlashSaleClaimWorkflow } from "@/workflows/flash-sales"
import { ClaimFlashSaleInput } from "../validators"

async function assertCartOwnership(req: AuthenticatedMedusaRequest) {
  const cartModule = req.scope.resolve(Modules.CART) as any
  const [cart] = await cartModule.listCarts({ id: req.params.id })
  if (!cart || cart.customer_id !== req.auth_context.actor_id) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found")
}

export async function POST(req: AuthenticatedMedusaRequest<ClaimFlashSaleInput>, res: MedusaResponse) {
  await assertCartOwnership(req)
  const { result } = await claimFlashSaleWorkflow(req.scope).run({ input: { cart_id: req.params.id, code: req.validatedBody.code } })
  res.status(200).json({ claim: result })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await assertCartOwnership(req)
  const { result } = await removeFlashSaleClaimWorkflow(req.scope).run({ input: { cart_id: req.params.id } })
  res.status(200).json({ removed_code: result })
}
