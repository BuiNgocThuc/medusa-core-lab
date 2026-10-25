import { Module } from "@medusajs/framework/utils"

import VnpayPaymentModuleService from "./service"

export const VNPAY_PAYMENT_MODULE = "vnpayPayment"

export default Module(VNPAY_PAYMENT_MODULE, {
  service: VnpayPaymentModuleService,
})
