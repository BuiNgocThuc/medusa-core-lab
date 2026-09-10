import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { FIRST_PURCHASE_PROMOTION_CODE } from "../constants"

export default async function setupPromotions({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const promotionModule = container.resolve(Modules.PROMOTION) as any

  const [existingWelcomePromotion] = await promotionModule.listPromotions({
    code: FIRST_PURCHASE_PROMOTION_CODE,
  })
  if (!existingWelcomePromotion) {
    await promotionModule.createPromotions({
      code: FIRST_PURCHASE_PROMOTION_CODE,
      type: "standard",
      status: "active",
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "across",
        value: 10,
      },
    })
    logger.info(`[promotions] created ${FIRST_PURCHASE_PROMOTION_CODE}`)
  }

  logger.info("[promotions] first-purchase promotion is ready")
}
