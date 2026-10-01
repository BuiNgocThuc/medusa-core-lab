import { Module } from "@medusajs/framework/utils"
import ConditionalPromotionModuleService from "./service"
export const CONDITIONAL_PROMOTION_MODULE = "conditional_promotion"
export default Module(CONDITIONAL_PROMOTION_MODULE, { service: ConditionalPromotionModuleService })
export { default as ConditionalPromotionModuleService } from "./service"
