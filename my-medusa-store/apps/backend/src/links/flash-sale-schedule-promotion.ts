import { defineLink } from "@medusajs/framework/utils"
import FlashSaleScheduleModule from "../modules/flash-sale-schedule"
import PromotionModule from "@medusajs/medusa/promotion"

export default defineLink(
  { linkable: FlashSaleScheduleModule.linkable.flashSaleSchedule, field: "promo_id" },
  PromotionModule.linkable.promotion,
  { readOnly: true },
)
