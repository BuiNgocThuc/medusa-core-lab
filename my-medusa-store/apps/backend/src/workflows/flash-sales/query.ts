import { Modules } from "@medusajs/framework/utils"
import { FLASH_SALE_SCHEDULE_MODULE, FlashSaleScheduleModuleService } from "@/modules/flash-sale-schedule"

export async function retrieveActiveFlashSaleSchedules(container: any) {
  const scheduleService = container.resolve(FLASH_SALE_SCHEDULE_MODULE) as FlashSaleScheduleModuleService
  const promotionModule = container.resolve(Modules.PROMOTION) as any
  const [schedules] = await scheduleService.listAndCountFlashSaleSchedules({ status: ["active", "scheduled"] } as any)
  if (!schedules.length) return { schedules: [], promotions: [] }
  const promotions = await promotionModule.listPromotions({ id: schedules.map((schedule: any) => schedule.promo_id) }, { relations: ["application_method", "campaign", "campaign.budget"] })
  return { schedules, promotions }
}
