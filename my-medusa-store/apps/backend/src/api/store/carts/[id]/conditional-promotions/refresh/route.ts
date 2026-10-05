import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { refreshConditionalPromotionsWorkflow } from "@/workflows"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  await refreshConditionalPromotionsWorkflow(req.scope).run({
    input: { cart_id: req.params.id },
  })

  res.status(200).json({})
}
