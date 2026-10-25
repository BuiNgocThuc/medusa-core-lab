import { PromotionEntitlementModuleService } from "@/modules/promotion-entitlement"
import { FlashSaleScheduleModuleService } from "@/modules/flash-sale-schedule"
import { throwInvalidPromotion } from "@/workflows/hooks/shared/errors"
import { campaignIsAvailable, isFlashScheduleOpen } from "./schedule"

export async function validateFlashSale(cart: any, entitlementService: PromotionEntitlementModuleService, scheduleService: FlashSaleScheduleModuleService, promotionService: any) {
  const [redemption] = await entitlementService.listFlashRedemptions({ cart_id: cart.id })
  const sourceRef = (cart.promotions ?? []).find((promotion: any) => promotion.metadata?.flash_source === true)
  if (!cart.customer?.id || !sourceRef || !redemption || redemption.state !== "reserved" || (redemption.expires_at && redemption.expires_at <= new Date())) throwInvalidPromotion("Flash Promotion không còn hiệu lực cho giỏ hàng này")
  const [schedule] = await scheduleService.listFlashSaleSchedules({ promo_id: sourceRef.id }) as any[]
  if (!schedule) throwInvalidPromotion("Flash Sale schedule không còn tồn tại")
  const source = await promotionService.retrievePromotion(schedule.promo_id, { relations: ["campaign"] })
  if (schedule.status === "inactive" || source.status !== "active" || !isFlashScheduleOpen(schedule) || !campaignIsAvailable(source.campaign)) throwInvalidPromotion("Flash Promotion không còn hiệu lực cho giỏ hàng này")
}
