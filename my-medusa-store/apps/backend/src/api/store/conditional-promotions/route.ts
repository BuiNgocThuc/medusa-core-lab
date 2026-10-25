import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONDITIONAL_PROMOTION_MODULE, ConditionalPromotionModuleService } from "../../../modules/conditional-promotion"
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(CONDITIONAL_PROMOTION_MODULE) as ConditionalPromotionModuleService
  const [rows] = await service.listAndCountConditionalPromotions({ status: "active" })
  res.json({ promotions: rows.map((row: any) => ({ id: row.id, title: row.title, description: row.description, terms: row.terms, cta_url: row.cta_url, placements: row.placements })) })
}
