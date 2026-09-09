import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { LOYALTY_MODULE } from "../../../../../modules/loyalty"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context.actor_id
  const loyaltyModule = req.scope.resolve(LOYALTY_MODULE) as any
  const [account] = await loyaltyModule.listLoyaltyAccounts({
    customer_id: customerId,
  })

  res.json({ loyalty_points: account?.balance ?? 0 })
}
