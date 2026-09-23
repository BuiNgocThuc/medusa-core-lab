import { Module } from "@medusajs/framework/utils"

import BankTransferPaymentModuleService from "./service"

export const BANK_TRANSFER_PAYMENT_MODULE = "bankTransferPayment"

export default Module(BANK_TRANSFER_PAYMENT_MODULE, {
  service: BankTransferPaymentModuleService,
})
