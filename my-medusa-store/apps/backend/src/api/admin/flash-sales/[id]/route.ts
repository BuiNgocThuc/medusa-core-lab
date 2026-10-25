import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IPromotionModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { FLASH_SALE_SCHEDULE_MODULE, FlashSaleScheduleModuleService } from "@/modules/flash-sale-schedule"
import { FlashSaleScheduleType } from "@/modules/flash-sale-schedule/models/flash-sale-schedule"
import { cleanupFlashSale } from "@/workflows/flash-sales"

async function current(scope: MedusaRequest["scope"], id: string) {
  const schedules = scope.resolve(FLASH_SALE_SCHEDULE_MODULE) as FlashSaleScheduleModuleService
  const promotion = scope.resolve(Modules.PROMOTION) as IPromotionModuleService
  const schedule = await schedules.retrieveFlashSaleSchedule(id) as FlashSaleScheduleType
  const source = await promotion.retrievePromotion(schedule.promo_id, { relations: ["application_method", "campaign", "campaign.budget"] })
  return { schedules, promotion, schedule, source }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { schedule, source } = await current(req.scope, req.params.id)
  res.json({ flash_sale: schedule, promotion: source, campaign: source.campaign })
}

export async function POST(_req: MedusaRequest, res: MedusaResponse) {
  res.status(405).json({ message: "Flash Sales are immutable. Delete this sale and create a new one." })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { schedules, promotion, schedule, source } = await current(req.scope, req.params.id)
  const campaignId = source.campaign_id ?? source.campaign?.id
  await schedules.updateFlashSaleSchedules({ id: schedule.id, status: "inactive" } as FlashSaleScheduleType)
  await promotion.updatePromotions({ id: source.id, status: "inactive" })
  await cleanupFlashSale(req.scope, schedule.id)
  await schedules.softDeleteFlashSaleSchedules(schedule.id)
  await promotion.softDeletePromotions(source.id)
  if (campaignId) await promotion.softDeleteCampaigns(campaignId)
  res.status(200).json({ id: schedule.id, deleted_at: new Date() })
}
