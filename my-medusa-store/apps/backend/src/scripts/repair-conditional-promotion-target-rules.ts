import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  CONDITIONAL_PROMOTION_MODULE,
  ConditionalPromotionModuleService,
} from "../modules/conditional-promotion"
import { nativeTargetRules } from "../api/admin/conditional-promotions/target-rules"

export default async function repairConditionalPromotionTargetRules({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as {
    info: (message: string) => void
  }
  const conditionalService = container.resolve(
    CONDITIONAL_PROMOTION_MODULE,
  ) as ConditionalPromotionModuleService
  const promotionService = container.resolve(Modules.PROMOTION) as any
  const [configs] = await conditionalService.listAndCountConditionalPromotions({})

  for (const config of configs as any[]) {
    const promotion = await promotionService.retrievePromotion(config.promo_id, {
      relations: ["application_method.target_rules"],
    })
    const targetRuleIds = promotion.application_method?.target_rules?.map(
      (rule: any) => rule.id,
    ) ?? []

    if (targetRuleIds.length) {
      await promotionService.removePromotionTargetRules(config.promo_id, targetRuleIds)
    }
    await promotionService.addPromotionTargetRules(
      config.promo_id,
      nativeTargetRules(config.target),
    )
    logger.info(`[conditional-promotions] repaired native target rules for ${promotion.code}`)
  }
}
