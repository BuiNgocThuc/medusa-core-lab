import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LOYALTY_MODULE } from "../../../../../modules/loyalty"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context.actor_id
  const loyaltyModule = req.scope.resolve(LOYALTY_MODULE) as any
  const [account] = await loyaltyModule.listLoyaltyAccounts({
    customer_id: customerId,
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "tier.name"],
    filters: { id: customerId },
  })
  const tier = customers[0]?.tier?.name?.toLowerCase() ?? "bronze"

  res.json({ loyalty_points: account?.balance ?? 0, tier })
}
