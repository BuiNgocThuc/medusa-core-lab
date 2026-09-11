import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  BANK_TRANSFER_PAYMENT_MODULE,
} from "../modules/bank-transfer-payment"
import BankTransferPaymentModuleService from "../modules/bank-transfer-payment/service"

export default async function expireBankTransferPayments(
  container: MedusaContainer
) {
  const bankTransferPaymentService =
    container.resolve<BankTransferPaymentModuleService>(
      BANK_TRANSFER_PAYMENT_MODULE
    )

  const expiredCount =
    await bankTransferPaymentService.expirePendingReferences()
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info(`Expired ${expiredCount} bank transfer payment reference(s)`)
}

export const config = {
  name: "expire-bank-transfer-payments",
  schedule: "*/5 * * * *",
}
