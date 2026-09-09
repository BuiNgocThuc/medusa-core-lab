import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { CUSTOMER_TIERS, type CustomerTier } from "../../../../../constants"
import { LOYALTY_MODULE } from "../../../../../modules/loyalty"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context.actor_id
  const loyaltyModule = req.scope.resolve(LOYALTY_MODULE) as any
  const [account] = await loyaltyModule.listLoyaltyAccounts({
    customer_id: customerId,
  })

  const customerModule = req.scope.resolve(Modules.CUSTOMER) as any
  const customer = await customerModule.retrieveCustomer(customerId, {
    relations: ["groups"],
  })
  const tier = (Object.entries(CUSTOMER_TIERS).find(([, definition]) =>
    customer.groups?.some(
      (group: { name: string }) => group.name === definition.name
    )
  )?.[0] ?? "bronze") as CustomerTier

  res.json({ loyalty_points: account?.balance ?? 0, tier })
}
