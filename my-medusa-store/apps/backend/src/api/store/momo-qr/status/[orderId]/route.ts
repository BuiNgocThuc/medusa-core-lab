import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { MOMO_PAYMENT_MODULE } from "../../../../../modules/momo-payment"
import MomoPaymentModuleService from "../../../../../modules/momo-payment/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const orderId = req.params?.orderId

  if (!orderId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "orderId route parameter is required"
    )
  }

  const momoPaymentService = req.scope.resolve(
    MOMO_PAYMENT_MODULE
  ) as MomoPaymentModuleService
  const payment = await momoPaymentService.retrievePaymentByMomoOrderId(orderId)

  if (!payment) {
    res.status(404).json({
      message: "MoMo payment was not found",
    })
    return
  }

  res.status(200).json({
    id: payment.id,
    paymentSessionId: payment.payment_session_id,
    momoOrderId: payment.momo_order_id,
    requestId: payment.request_id,
    amount: payment.amount,
    currencyCode: payment.currency_code,
    status: payment.status,
    resultCode: payment.result_code,
    message: payment.message,
    transId: payment.trans_id,
    payType: payment.pay_type,
    paymentOption: payment.payment_option,
    orderType: payment.order_type,
    qrCodeUrl: payment.qr_code_url,
    payUrl: payment.pay_url,
    shortLink: payment.short_link,
    deeplink: payment.deeplink,
    deeplinkMiniApp: payment.deeplink_mini_app,
    paidAt: payment.paid_at,
    expiresAt: payment.expires_at,
    createdAt: payment.created_at,
    updatedAt: payment.updated_at,
  })
}
