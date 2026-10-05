import { Module } from "@medusajs/framework/utils"
import FlashSaleScheduleModuleService from "./service"

export const FLASH_SALE_SCHEDULE_MODULE = "flash_sale_schedule"
export default Module(FLASH_SALE_SCHEDULE_MODULE, { service: FlashSaleScheduleModuleService })
export { default as FlashSaleScheduleModuleService } from "./service"
