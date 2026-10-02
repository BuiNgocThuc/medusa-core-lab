/**
 * Custom Admin API Route cho MoMo Refund Audit:
 * - Cung cấp thông tin thanh toán & lịch sử refund MoMo cho Admin Widget UI.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { MOMO_PAYMENT_MODULE } from "../../../modules/momo-payment"
import MomoPaymentModuleService from "../../../modules/momo-payment/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const paymentSessionId = normalizeQueryValue(req.query.payment_session_id)

  if (!paymentSessionId) {
    res.status(400).json({
      message: "payment_session_id is required",
    })
    return
  }

  const momoPaymentService = req.scope.resolve<MomoPaymentModuleService>(
    MOMO_PAYMENT_MODULE
  )
  const payment = await momoPaymentService.retrievePaymentBySessionId(
    paymentSessionId
  )

  if (!payment) {
    res.status(404).json({
      message: "MoMo payment not found",
    })
    return
  }

  const refunds = await momoPaymentService.listRefundsForPayment(payment.id)

  res.status(200).json({
    payment,
    refunds,
  })
}

function normalizeQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined
  }

  return typeof value === "string" && value ? value : undefined
}
