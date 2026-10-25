import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { FLASH_SALE_SCHEDULE_MODULE, FlashSaleScheduleModuleService } from "@/modules/flash-sale-schedule"

const CAMPAIGN_IDENTIFIER = "FLASH_SALE_DAILY_16_18"
const PROMOTION_CODE = "FLASH20_DAILY"
const TIMEZONE = "Asia/Ho_Chi_Minh"

export default async function seedFlashSales({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const promotionModule = container.resolve(Modules.PROMOTION) as any
  const schedules = container.resolve(FLASH_SALE_SCHEDULE_MODULE) as FlashSaleScheduleModuleService
  const now = new Date()
  const startsAt = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const endsAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

  let [campaign] = await promotionModule.listCampaigns({ campaign_identifier: CAMPAIGN_IDENTIFIER })
  if (campaign) {
    campaign = await promotionModule.updateCampaigns({ id: campaign.id, name: "Flash Sale Daily 16:00–18:00", starts_at: startsAt, ends_at: endsAt })
  } else {
    campaign = await promotionModule.createCampaigns({ name: "Flash Sale Daily 16:00–18:00", campaign_identifier: CAMPAIGN_IDENTIFIER, starts_at: startsAt, ends_at: endsAt })
  }

  const [budget] = await promotionModule.listCampaignBudgets({ campaign_id: campaign.id })
  if (budget) await promotionModule.updateCampaignBudgets({ id: budget.id, type: "spend", limit: 20_000_000, currency_code: "vnd" })
  else await promotionModule.createCampaignBudgets({ campaign: campaign.id, type: "spend", limit: 20_000_000, currency_code: "vnd" })

  let [promotion] = await promotionModule.listPromotions({ code: PROMOTION_CODE })
  const promotionData = {
    code: PROMOTION_CODE,
    type: "standard",
    status: "active",
    is_automatic: false,
    campaign_id: campaign.id,
    application_method: { type: "percentage", value: 20, target_type: "order", allocation: "across" },
    metadata: { source: "flash-sale-schedule", flash_source: true, usage_limit: 2, seed: "flash-sale" },
  }
  if (promotion) promotion = await promotionModule.updatePromotions({ id: promotion.id, ...promotionData })
  else promotion = await promotionModule.createPromotions(promotionData)

  const [schedule] = await schedules.listFlashSaleSchedules({ promo_id: promotion.id })
  const scheduleData = {
    promo_id: promotion.id,
    status: "active",
    timezone: TIMEZONE,
    start_time: "16:00",
    end_time: "18:00",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    max_discount_amount: 300_000,
  }
  if (schedule) await schedules.updateFlashSaleSchedules({ id: schedule.id, ...scheduleData } as any)
  else await schedules.createFlashSaleSchedules(scheduleData as any)

  logger.info(`[seed:flash-sales] ${PROMOTION_CODE} is ready for 16:00–18:00 ${TIMEZONE}`)
}
