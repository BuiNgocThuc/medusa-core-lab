import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IPromotionModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { FLASH_SALE_SCHEDULE_MODULE, FlashSaleScheduleModuleService } from "@/modules/flash-sale-schedule"
import { cleanupFlashSale } from "@/workflows/flash-sales"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const schedules = req.scope.resolve(FLASH_SALE_SCHEDULE_MODULE) as FlashSaleScheduleModuleService
  const promotion = req.scope.resolve(Modules.PROMOTION) as IPromotionModuleService
  const current = await schedules.retrieveFlashSaleSchedule(req.params.id)
  const status = current.status === "inactive" ? "active" : "inactive"
  await schedules.updateFlashSaleSchedules({ id: current.id, status } as any)
  await promotion.updatePromotions({ id: current.promo_id, status: status === "inactive" ? "inactive" : "active" })
  if (status === "inactive") await cleanupFlashSale(req.scope, current.id)
  res.json({ id: current.id, status })
}
