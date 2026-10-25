/**
 * Cron Job Reconcile MoMo Payments:
 * - Quét các giao dịch MoMo đang pending/authorized, gọi MoMo Query API để xác nhận trạng thái và đồng bộ workflow.
 */
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows"

import { MomoClient } from "../modules/momo/client"
import {
  MOMO_PAYMENT_MODULE,
} from "../modules/momo-payment"
import MomoPaymentModuleService from "../modules/momo-payment/service"

export default async function reconcileMomoPayments(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  if (
    !process.env.MOMO_PARTNER_CODE ||
      !process.env.MOMO_ACCESS_KEY ||
      !process.env.MOMO_SECRET_KEY ||
      !process.env.MOMO_REDIRECT_URL ||
      !process.env.MOMO_IPN_URL
  ) {
    logger.info("[momo] Reconciliation skipped because MoMo is not configured")
    return
  }

  const momoPaymentService = container.resolve<MomoPaymentModuleService>(
    MOMO_PAYMENT_MODULE
  )
  const momoClient = new MomoClient({
    partnerCode: process.env.MOMO_PARTNER_CODE,
    accessKey: process.env.MOMO_ACCESS_KEY,
    secretKey: process.env.MOMO_SECRET_KEY,
    endpoint: process.env.MOMO_ENDPOINT || "https://test-payment.momo.vn",
    redirectUrl:
      process.env.MOMO_REDIRECT_URL ||
      "http://localhost:8000/api/payment-return/momo",
    ipnUrl:
      process.env.MOMO_IPN_URL ||
      "http://localhost:9001/hooks/payment/momo_default",
    lang: (process.env.MOMO_LANG || "vi") as "vi" | "en",
  })

  const candidates = await momoPaymentService.listReconciliationCandidates(50)

  for (const payment of candidates) {
    try {
      const response = await momoClient.queryPayment({
        orderId: payment.momo_order_id,
        requestId: payment.request_id,
        amount: payment.amount,
      })

      await momoPaymentService.markPaymentQueried(payment.id)

      if (response.resultCode !== 0 || !response.transId) {
        continue
      }

      const result = await momoPaymentService.completePaymentFromIpn({
        momo_order_id: payment.momo_order_id,
        request_id: payment.request_id,
        amount: response.amount ?? payment.amount,
        result_code: response.resultCode,
        message: response.message,
        trans_id: response.transId.toString(),
        pay_type: response.payType,
        raw_payload: response as Record<string, unknown>,
        signature_valid: true,
        event_key: [
          "query",
          payment.momo_order_id,
          payment.request_id,
          response.transId,
          response.resultCode,
        ].join(":"),
      })

      if (result.process_payment && result.payment_session_id && result.amount) {
        await processPaymentWorkflow(container).run({
          input: {
            action: "authorized",
            data: {
              session_id: result.payment_session_id,
              amount: result.amount,
            },
          },
        })

        await processPaymentWorkflow(container).run({
          input: {
            action: "captured",
            data: {
              session_id: result.payment_session_id,
              amount: result.amount,
            },
          },
        })
      }
    } catch (error) {
      logger.error(
        `[momo] Failed to reconcile payment ${payment.momo_order_id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }
}

export const config = {
  name: "reconcile-momo-payments",
  schedule: "*/5 * * * *",
}
