import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { VNPAY_PAYMENT_MODULE } from "../../../modules/vnpay-payment"
import VnpayPaymentModuleService from "../../../modules/vnpay-payment/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const paymentSessionId = normalizeQueryValue(req.query.payment_session_id)

  if (!paymentSessionId) {
    res.status(400).json({
      message: "payment_session_id is required",
    })
    return
  }

  const vnpayPaymentService = req.scope.resolve<VnpayPaymentModuleService>(
    VNPAY_PAYMENT_MODULE
  )
  const payment = await vnpayPaymentService.retrievePaymentBySessionId(
    paymentSessionId
  )

  if (!payment) {
    res.status(404).json({
      message: "VNPay payment not found",
    })
    return
  }

  const refunds = await vnpayPaymentService.listRefundsForPayment(payment.id)

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
