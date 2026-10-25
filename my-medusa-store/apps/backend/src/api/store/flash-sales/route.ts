import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { FLASH_SALE_SCHEDULE_MODULE, FlashSaleScheduleModuleService } from "@/modules/flash-sale-schedule"
import { campaignIsAvailable, flashScheduleEnd, isFlashScheduleOpen } from "@/workflows/flash-sales"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const schedules = req.scope.resolve(FLASH_SALE_SCHEDULE_MODULE) as FlashSaleScheduleModuleService
  const promotion = req.scope.resolve(Modules.PROMOTION) as any
  const [rows] = await schedules.listAndCountFlashSaleSchedules({ status: ["active", "scheduled"] } as any)
  const promotions = rows.length ? await promotion.listPromotions({ id: rows.map((row: any) => row.promo_id) }, { relations: ["application_method", "campaign"] }) : []
  const byId = new Map<string, any>(promotions.map((entry: any) => [entry.id, entry]))
  const now = new Date()
  const flash_sales = rows.flatMap((schedule: any) => {
    const source = byId.get(schedule.promo_id)
    if (!source || source.status !== "active" || !isFlashScheduleOpen(schedule, now) || !campaignIsAvailable(source.campaign, now)) return []
    return [{ code: source.code, percentage: Number(source.application_method?.value), max_discount_amount: Number(schedule.max_discount_amount), ends_at: flashScheduleEnd(schedule, now).toISOString(), timezone: schedule.timezone }]
  })
  res.json({ flash_sales })
}
