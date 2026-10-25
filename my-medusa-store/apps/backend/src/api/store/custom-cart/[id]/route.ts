import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const {id} = req.params;
    const { data: [cart] } = await query.graph({
    entity: "cart",
    fields: [
    "id",
    "payment_collection.*",
    "payment_collection.payment_sessions.*"
    ],
    filters: {
      id,
    },
  })
     res.json({ cart })

    res.sendStatus(200);
}
