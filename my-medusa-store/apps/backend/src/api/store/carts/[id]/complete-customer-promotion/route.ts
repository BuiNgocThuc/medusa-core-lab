import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { completeCustomerPromotionCartWorkflow } from "@/src/workflows"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const { result } = await completeCustomerPromotionCartWorkflow(req.scope).run({
        input: { cart_id: req.params.id },
    })
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
    const { data: orders } = await query.graph({
        entity: "order",
        fields: ["*", "items.*", "shipping_address.*", "billing_address.*"],
        filters: { id: result.id },
    })

    res.status(200).json({ type: "order", order: orders[0] })
}
