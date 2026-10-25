import { Module } from "@medusajs/framework/utils"
import PromotionEntitlementModuleService from "./service"

export const PROMOTION_ENTITLEMENT_MODULE = "promotion_entitlement"

export default Module(PROMOTION_ENTITLEMENT_MODULE, {
    service: PromotionEntitlementModuleService,
})

export { default as PromotionEntitlementModuleService } from "./service"
