import { Module } from "@medusajs/framework/utils"

import MomoPaymentModuleService from "./service"

export const MOMO_PAYMENT_MODULE = "momoPayment"

export default Module(MOMO_PAYMENT_MODULE, {
  service: MomoPaymentModuleService,
})
