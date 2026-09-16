import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import {
  encodeMomoExtraData,
  getMomoDevOptions,
  getMomoExpiresAt,
  maskMomoRequest,
} from "../../../../lib/momo-dev"
import { MomoClient } from "../../../../modules/momo/client"
import { randomMomoId } from "../../../../modules/momo/crypto"
import { MOMO_PAYMENT_MODULE } from "../../../../modules/momo-payment"
import MomoPaymentModuleService from "../../../../modules/momo-payment/service"

type CreateMomoQrBody = {
  amount?: number | string
  orderInfo?: string
  cartId?: string
  orderId?: string
  paymentSessionId?: string
  extraData?: Record<string, unknown>
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body ?? {}) as CreateMomoQrBody
  const amount = toIntegerAmount(body.amount)

  if (!amount || amount < 1000) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "amount must be an integer VND value and at least 1000"
    )
  }

  const options = getMomoDevOptions()
  const client = new MomoClient(options)
  const momoPaymentService = req.scope.resolve(
    MOMO_PAYMENT_MODULE
  ) as MomoPaymentModuleService

  const momoOrderId = body.orderId || randomMomoId("MMQR")
  const requestId = randomMomoId("MRQR")
  const paymentSessionId = body.paymentSessionId || `dev_${momoOrderId}`
  const orderInfo = body.orderInfo || `Medusa MoMo QR test ${momoOrderId}`
  const extraData = encodeMomoExtraData({
    source: "momo_qr_dev_api",
    payment_session_id: paymentSessionId,
    cart_id: body.cartId,
    ...body.extraData,
  })

  const { request, response } = await client.createPayment({
    orderId: momoOrderId,
    requestId,
    amount,
    orderInfo,
    extraData,
  })

  const resultCode = response.resultCode ?? -1
  const status = resultCode === 0 || resultCode === 1000 ? "pending" : "failed"
  const expiresAt = getMomoExpiresAt(options.orderExpireTimeMinutes ?? 15)

  await momoPaymentService.upsertPaymentFromSession({
    payment_session_id: paymentSessionId,
    cart_id: body.cartId,
    provider_id: options.providerId || "pp_momo_default",
    momo_order_id: momoOrderId,
    request_id: requestId,
    amount,
    currency_code: "vnd",
    status,
    pay_url: response.payUrl,
    short_link: response.shortLink,
    deeplink: response.deeplink,
    qr_code_url: response.qrCodeUrl,
    deeplink_mini_app: response.deeplinkMiniApp,
    user_fee: response.userFee,
    expires_at: expiresAt,
    raw_create_request: maskMomoRequest(request as Record<string, unknown>),
    raw_create_response: response as Record<string, unknown>,
    metadata: {
      order_info: orderInfo,
      source: "momo_qr_dev_api",
    },
  })

  res.status(200).json({
    paymentSessionId,
    momoOrderId,
    requestId,
    amount,
    status,
    resultCode,
    message: response.message,
    qrCodeUrl: response.qrCodeUrl,
    payUrl: response.payUrl,
    shortLink: response.shortLink,
    deeplink: response.deeplink,
    deeplinkMiniApp: response.deeplinkMiniApp,
    expiresAt: expiresAt.toISOString(),
    mockEnabled: Boolean(options.mockEnabled),
  })
}

function toIntegerAmount(value: unknown) {
  const amount = typeof value === "string" ? Number(value) : value

  return Number.isInteger(amount) ? (amount as number) : 0
}
