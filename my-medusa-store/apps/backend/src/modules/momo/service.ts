import {
  AbstractPaymentProvider,
  MedusaError,
} from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"

import { MOMO_PAYMENT_MODULE } from "../momo-payment"
import MomoPaymentModuleService from "../momo-payment/service"
import type { CompleteMomoPaymentResult } from "../momo-payment/types"
import { MomoClient } from "./client"
import {
  buildIpnSignatureData,
  randomMomoId,
  signMomoPayload,
  timingSafeStringEqual,
} from "./crypto"
import type {
  MomoIpnPayload,
  MomoProviderOptions,
  MomoSessionData,
} from "./types"

type InjectedDependencies = {
  logger: Logger
  [MOMO_PAYMENT_MODULE]?: MomoPaymentModuleService
}

const DEFAULT_PROVIDER_ID = "pp_momo_default"
const DEFAULT_ENDPOINT = "https://test-payment.momo.vn"
const DEFAULT_EXPIRE_MINUTES = 15

class MomoPaymentProviderService extends AbstractPaymentProvider<MomoProviderOptions> {
  static identifier = "momo"

  protected readonly logger_: Logger
  protected readonly options_: MomoProviderOptions
  protected readonly momoPaymentService_?: MomoPaymentModuleService
  protected readonly momoClient_: MomoClient

  constructor(container: InjectedDependencies, options: MomoProviderOptions) {
    super(container, options)

    this.logger_ = container.logger
    this.momoPaymentService_ = container[MOMO_PAYMENT_MODULE]
    this.options_ = {
      endpoint: DEFAULT_ENDPOINT,
      providerId: DEFAULT_PROVIDER_ID,
      requestType: "captureWallet",
      autoCapture: true,
      lang: "vi",
      orderExpireTimeMinutes: DEFAULT_EXPIRE_MINUTES,
      ...options,
    }
    this.momoClient_ = new MomoClient(this.options_)
  }

  static validateOptions(options: Record<string, unknown>) {
    if (options.mockEnabled) {
      return
    }

    for (const key of [
      "partnerCode",
      "accessKey",
      "secretKey",
      "redirectUrl",
      "ipnUrl",
    ]) {
      if (!options[key]) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `MoMo provider option "${key}" is required`
        )
      }
    }
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const sessionId = this.getSessionId(input.data)

    if (!sessionId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "MoMo requires the Medusa payment session id"
      )
    }

    const amount = this.toNumber(input.amount)
    const currencyCode = input.currency_code.toLowerCase()

    this.assertVndPayment(amount, currencyCode)

    const momoOrderId = this.getMomoOrderId(input.data) ?? randomMomoId("MM")
    const requestId = this.getRequestId(input.data) ?? randomMomoId("MR")
    const expiresAt = this.getExpiresAt()
    const orderInfo = `Medusa cart payment ${sessionId}`
    const extraData = this.encodeExtraData({
      payment_session_id: sessionId,
    })

    const { request, response } = await this.momoClient_.createPayment({
      orderId: momoOrderId,
      requestId,
      amount,
      orderInfo,
      extraData,
    })

    const resultCode = response.resultCode ?? -1
    const status = resultCode === 0 || resultCode === 1000 ? "pending" : "failed"
    const data: MomoSessionData = {
      id: momoOrderId,
      session_id: sessionId,
      provider_session_id: momoOrderId,
      momo_order_id: momoOrderId,
      request_id: requestId,
      amount,
      currency_code: currencyCode,
      pay_url: response.payUrl,
      short_link: response.shortLink,
      deeplink: response.deeplink,
      qr_code_url: response.qrCodeUrl,
      deeplink_mini_app: response.deeplinkMiniApp,
      user_fee: response.userFee,
      result_code: resultCode,
      message: response.message,
      expires_at: expiresAt.toISOString(),
    }

    await this.momoPaymentService_?.upsertPaymentFromSession({
      payment_session_id: sessionId,
      provider_id: this.options_.providerId ?? DEFAULT_PROVIDER_ID,
      momo_order_id: momoOrderId,
      request_id: requestId,
      amount,
      currency_code: currencyCode,
      status,
      pay_url: response.payUrl,
      short_link: response.shortLink,
      deeplink: response.deeplink,
      qr_code_url: response.qrCodeUrl,
      deeplink_mini_app: response.deeplinkMiniApp,
      user_fee: response.userFee,
      expires_at: expiresAt,
      raw_create_request: this.maskCreateRequest(request),
      raw_create_response: response as Record<string, unknown>,
      metadata: {
        order_info: orderInfo,
        deeplink_mini_app: response.deeplinkMiniApp,
        user_fee: response.userFee,
      },
    })

    if (status === "failed") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        response.message ?? "MoMo create payment failed"
      )
    }

    this.logger_.info(
      `Created MoMo payment ${momoOrderId} for session ${sessionId}`
    )

    return {
      id: momoOrderId,
      status: "pending",
      data,
    }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const amount = this.toNumber(input.amount)
    const currencyCode = input.currency_code.toLowerCase()

    this.assertVndPayment(amount, currencyCode)

    return {
      status: "pending",
      data: {
        ...input.data,
        amount,
        currency_code: currencyCode,
        updated_at: new Date().toISOString(),
      },
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const sessionId = this.getSessionId(input.data)
    const payment = sessionId
      ? await this.momoPaymentService_?.retrievePaymentBySessionId(sessionId)
      : undefined

    if (payment?.status === "paid" || payment?.status === "authorized") {
      return {
        status: "authorized",
        data: {
          ...input.data,
          trans_id: payment.trans_id,
          result_code: payment.result_code,
          paid_at: payment.paid_at?.toISOString?.() ?? payment.paid_at,
        },
      }
    }

    if (payment?.status === "failed" || payment?.status === "canceled") {
      return {
        status: "error",
        data: input.data,
      }
    }

    return {
      status: "pending_authorization",
      data: input.data,
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return {
      data: {
        ...input.data,
        captured_at: input.data?.captured_at ?? new Date().toISOString(),
      },
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const amount = this.toNumber(input.amount)
    const sessionId = this.getSessionId(input.data)
    const payment = sessionId
      ? await this.momoPaymentService_?.retrievePaymentBySessionId(sessionId)
      : undefined
    const transId = payment?.trans_id ?? input.data?.trans_id

    if (!payment || !transId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "MoMo refund requires a paid transaction with transId"
      )
    }

    const requestId = randomMomoId("MRF")
    const refundOrderId = randomMomoId("MRO")
    const description = `Refund MoMo payment ${payment.momo_order_id}`
    const { request, response } = await this.momoClient_.refund({
      orderId: refundOrderId,
      requestId,
      amount,
      transId,
      description,
    })

    await this.momoPaymentService_?.createRefund({
      momo_payment_id: payment.id,
      refund_order_id: refundOrderId,
      request_id: requestId,
      amount,
      raw_request: this.maskRefundRequest(request),
    })
    await this.momoPaymentService_?.updateRefundFromResponse({
      request_id: requestId,
      status: response.resultCode === 0 ? "succeeded" : "failed",
      result_code: response.resultCode,
      message: response.message,
      refund_trans_id: response.transId?.toString(),
      raw_response: response as Record<string, unknown>,
    })

    if (response.resultCode !== 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        response.message ?? "MoMo refund failed"
      )
    }

    return {
      data: {
        ...input.data,
        last_refund_amount: amount,
        last_refund_status: "succeeded",
        last_refund_order_id: refundOrderId,
        last_refund_request_id: requestId,
      },
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return {
      data: {
        ...input.data,
        canceled_at: new Date().toISOString(),
      },
    }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return {
      data: {
        ...input.data,
        deleted_at: new Date().toISOString(),
      },
    }
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    return {
      data: input.data,
    }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const sessionId = this.getSessionId(input.data)
    const payment = sessionId
      ? await this.momoPaymentService_?.retrievePaymentBySessionId(sessionId)
      : undefined

    if (payment?.status === "paid" || payment?.status === "authorized") {
      return {
        status: "authorized",
        data: input.data,
      }
    }

    if (payment?.status === "failed" || payment?.status === "canceled") {
      return {
        status: "error",
        data: input.data,
      }
    }

    return {
      status: "pending_authorization",
      data: input.data,
    }
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const body = this.getWebhookBody(payload)
    const result = await this.processIpn(body)

    if (!result.process_payment || !result.payment_session_id || !result.amount) {
      const data =
        result.payment_session_id && result.amount
          ? {
              session_id: result.payment_session_id,
              amount: result.amount,
            }
          : undefined

      return {
        action: result.status === "failed" ? "failed" : "not_supported",
        data,
      }
    }

    return {
      action: result.status === "authorized" ? "authorized" : "captured",
      data: {
        session_id: result.payment_session_id,
        amount: result.amount,
      },
    }
  }

  async processIpn(body: MomoIpnPayload): Promise<CompleteMomoPaymentResult> {
    const amount = this.toNumber(body.amount)
    const resultCode = this.toNumber(body.resultCode)
    const momoOrderId = body.orderId
    const requestId = body.requestId
    const signature = body.signature

    if (!momoOrderId || !requestId || !body.partnerCode || !signature) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "MoMo IPN is missing required fields"
      )
    }

    if (body.partnerCode !== this.options_.partnerCode) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "MoMo IPN partnerCode mismatch"
      )
    }

    const rawSignatureData = buildIpnSignatureData({
      accessKey: this.options_.accessKey,
      amount: body.amount ?? "",
      extraData: body.extraData ?? "",
      message: body.message ?? "",
      orderId: momoOrderId,
      orderInfo: body.orderInfo ?? "",
      orderType: body.orderType ?? "",
      partnerCode: body.partnerCode,
      payType: body.payType ?? "",
      requestId,
      responseTime: body.responseTime ?? "",
      resultCode: body.resultCode ?? "",
      transId: body.transId ?? "",
    })
    const expectedSignature = signMomoPayload(
      rawSignatureData,
      this.options_.secretKey
    )
    const signatureValid = timingSafeStringEqual(signature, expectedSignature)
    const eventKey = [
      body.partnerCode,
      momoOrderId,
      requestId,
      body.transId ?? "",
      body.resultCode ?? "",
      body.responseTime ?? "",
    ].join(":")

    return this.momoPaymentService_?.completePaymentFromIpn({
      momo_order_id: momoOrderId,
      request_id: requestId,
      amount,
      result_code: resultCode,
      message: body.message,
      trans_id: body.transId?.toString(),
      pay_type: body.payType,
      payment_option: body.paymentOption,
      order_type: body.orderType,
      user_fee: body.userFee,
      raw_payload: body as Record<string, unknown>,
      signature_valid: signatureValid,
      event_key: eventKey,
    }) ?? {
      status: "not_found" as const,
      process_payment: false,
      reason: "MoMo payment module is not registered",
    }
  }

  private getWebhookBody(payload: ProviderWebhookPayload["payload"]) {
    const data = payload.data

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {}
    }

    return data as MomoIpnPayload
  }

  private getSessionId(data?: Record<string, unknown>) {
    const sessionId = data?.session_id

    return typeof sessionId === "string" ? sessionId : undefined
  }

  private getMomoOrderId(data?: Record<string, unknown>) {
    const orderId = data?.momo_order_id ?? data?.provider_session_id ?? data?.id

    return typeof orderId === "string" ? orderId : undefined
  }

  private getRequestId(data?: Record<string, unknown>) {
    const requestId = data?.request_id

    return typeof requestId === "string" ? requestId : undefined
  }

  private getExpiresAt() {
    const expiresAt = new Date()
    expiresAt.setMinutes(
      expiresAt.getMinutes() +
        (this.options_.orderExpireTimeMinutes ?? DEFAULT_EXPIRE_MINUTES)
    )

    return expiresAt
  }

  private encodeExtraData(data: Record<string, unknown>) {
    return Buffer.from(JSON.stringify(data)).toString("base64")
  }

  private assertVndPayment(amount: number, currencyCode: string) {
    if (!Number.isInteger(amount) || amount < 1000) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "MoMo amount must be an integer and at least 1000 VND"
      )
    }

    if (currencyCode !== "vnd") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "MoMo only supports VND payments in this provider"
      )
    }
  }

  private maskCreateRequest(request: Record<string, unknown>) {
    return {
      ...request,
      signature: "[masked]",
    }
  }

  private maskRefundRequest(request: Record<string, unknown>) {
    return {
      ...request,
      signature: "[masked]",
    }
  }

  private toNumber(value: unknown) {
    if (typeof value === "number") {
      return value
    }

    if (typeof value === "string") {
      return Number(value)
    }

    if (value && typeof value === "object") {
      if ("numeric" in value && typeof value.numeric === "number") {
        return value.numeric
      }

      if ("value" in value) {
        return Number(value.value)
      }

      if ("toJSON" in value && typeof value.toJSON === "function") {
        return Number(value.toJSON())
      }

      if ("toString" in value && typeof value.toString === "function") {
        return Number(value.toString())
      }
    }

    return 0
  }
}

export default MomoPaymentProviderService
