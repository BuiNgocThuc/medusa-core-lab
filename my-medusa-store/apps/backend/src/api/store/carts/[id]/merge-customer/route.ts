// src/api/store/carts/[id]/merge-customer/route.ts
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { HttpTypes } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  remoteQueryObjectFromString,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"

export async function POST(
  req: AuthenticatedMedusaRequest<{ additional_data?: unknown }, HttpTypes.SelectParams>,
  res: MedusaResponse<HttpTypes.StoreCartResponse>
) {
  const id = req.params.id
  const customer_id = req.auth_context?.actor_id

  const we = req.scope.resolve(Modules.WORKFLOW_ENGINE)

  await we.run("merge-guest-cart-into-customer-cart", {
    input: {
      guest_cart_id: id,
      customer_id,
      additional_data: req.validatedBody?.additional_data,
    },
  })

  const remoteQuery = req.scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)

  const queryObject = remoteQueryObjectFromString({
    entryPoint: "cart",
    variables: { filters: { id } },
    fields: req.queryConfig.fields,
  })

  const [cart] = await remoteQuery(queryObject)

  if (!cart) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Cart with id '${id}' not found`)
  }

  res.status(200).json({ cart })
}