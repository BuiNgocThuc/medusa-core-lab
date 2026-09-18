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

import { VNPAY_PAYMENT_MODULE } from "../vnpay-payment"
import VnpayPaymentModuleService from "../vnpay-payment/service"
import type { CompleteVnpayPaymentResult } from "../vnpay-payment/types"
import {
  buildVnpaySignData,
  formatVnpayDate,
  randomVnpayTxnRef,
  signVnpayPayload,
  verifyVnpaySignature,
  withoutVnpayHashParams,
} from "./crypto"
import type {
  VnpayGatewayPayload,
  VnpayProviderOptions,
  VnpaySessionData,
} from "./types"

type InjectedDependencies = {
  logger: Logger
  [VNPAY_PAYMENT_MODULE]?: VnpayPaymentModuleService
}

const DEFAULT_PROVIDER_ID = "pp_vnpay_default"
const DEFAULT_PAYMENT_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
const DEFAULT_EXPIRY_MINUTES = 15

class VnpayPaymentProviderService extends AbstractPaymentProvider<VnpayProviderOptions> {
  static identifier = "vnpay"

  protected readonly logger_: Logger
  protected readonly options_: VnpayProviderOptions
  protected readonly vnpayPaymentService_?: VnpayPaymentModuleService

  constructor(container: InjectedDependencies, options: VnpayProviderOptions) {
    super(container, options)

    this.logger_ = container.logger
    this.vnpayPaymentService_ = container[VNPAY_PAYMENT_MODULE]
    this.options_ = {
      paymentUrl: DEFAULT_PAYMENT_URL,
      providerId: DEFAULT_PROVIDER_ID,
      locale: "vn",
      orderType: "other",
      command: "pay",
      version: "2.1.0",
      paymentExpiryMinutes: DEFAULT_EXPIRY_MINUTES,
      ...options,
    }
  }

  static validateOptions(options: Record<string, unknown>) {
    for (const key of ["tmnCode", "hashSecret", "returnUrl"]) {
      if (!options[key]) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `VNPay provider option "${key}" is required`
        )
      }
    }
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const sessionId = this.getSessionId(input.data)

    if (!sessionId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "VNPay requires the Medusa payment session id"
      )
    }

    const amount = this.toNumber(input.amount)
    const currencyCode = input.currency_code.toLowerCase()

    this.assertVndPayment(amount, currencyCode)

    const txnRef = this.getTxnRef(input.data) ?? randomVnpayTxnRef()
    const expiresAt = this.getExpiresAt()
    const createDate = formatVnpayDate(new Date())
    const expireDate = formatVnpayDate(expiresAt)
    const orderInfo = `Medusa cart payment ${sessionId}`
    const params = {
      vnp_Version: this.options_.version ?? "2.1.0",
      vnp_Command: this.options_.command ?? "pay",
      vnp_TmnCode: this.options_.tmnCode,
      vnp_Amount: amount * 100,
      vnp_CurrCode: "VND",
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: this.options_.orderType ?? "other",
      vnp_Locale: this.options_.locale ?? "vn",
      vnp_ReturnUrl: this.options_.returnUrl,
      vnp_IpAddr: "127.0.0.1",
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate,
    }
    const signData = buildVnpaySignData(params)
    const secureHash = signVnpayPayload(signData, this.options_.hashSecret)
    const paymentUrl = `${(this.options_.paymentUrl ?? DEFAULT_PAYMENT_URL).replace(
      /\?$/,
      ""
    )}?${signData}&vnp_SecureHash=${secureHash}`
    const data: VnpaySessionData = {
      id: txnRef,
      session_id: sessionId,
      provider_session_id: txnRef,
      vnp_txn_ref: txnRef,
      amount,
      currency_code: currencyCode,
      payment_url: paymentUrl,
      expires_at: expiresAt.toISOString(),
    }

    await this.vnpayPaymentService_?.upsertPaymentFromSession({
      payment_session_id: sessionId,
      provider_id: this.options_.providerId ?? DEFAULT_PROVIDER_ID,
      vnp_txn_ref: txnRef,
      amount,
      currency_code: currencyCode,
      status: "pending",
      payment_url: paymentUrl,
      expires_at: expiresAt,
      raw_create_params: {
        ...params,
        vnp_SecureHash: "[masked]",
      },
      metadata: {
        order_info: orderInfo,
        create_date: createDate,
        ipn_url: this.options_.ipnUrl,
      },
    })

    this.logger_.info(`Created VNPay payment ${txnRef} for session ${sessionId}`)

    return {
      id: txnRef,
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
      ? await this.vnpayPaymentService_?.retrievePaymentBySessionId(sessionId)
      : undefined

    if (payment?.status === "paid") {
      return {
        status: "authorized",
        data: {
          ...input.data,
          vnp_transaction_no: payment.transaction_no,
          vnp_response_code: payment.response_code,
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
    return {
      data: {
        ...input.data,
        last_refund_amount: this.toNumber(input.amount),
        last_refund_status: "manual_required",
        last_refund_requested_at: new Date().toISOString(),
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
      ? await this.vnpayPaymentService_?.retrievePaymentBySessionId(sessionId)
      : undefined

    if (payment?.status === "paid") {
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
    const result = await this.processGatewayPayload(body)

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
      action: "captured",
      data: {
        session_id: result.payment_session_id,
        amount: result.amount,
      },
    }
  }

  async processGatewayPayload(
    body: VnpayGatewayPayload
  ): Promise<CompleteVnpayPaymentResult> {
    const txnRef = body.vnp_TxnRef
    const tmnCode = body.vnp_TmnCode

    if (!txnRef || !tmnCode || !body.vnp_SecureHash) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "VNPay payload is missing required fields"
      )
    }

    if (tmnCode !== this.options_.tmnCode) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "VNPay tmnCode mismatch"
      )
    }

    const signatureValid = verifyVnpaySignature(body, this.options_.hashSecret)
    const eventKey = [
      tmnCode,
      txnRef,
      body.vnp_TransactionNo ?? "",
      body.vnp_ResponseCode ?? "",
      body.vnp_TransactionStatus ?? "",
      body.vnp_PayDate ?? "",
    ].join(":")

    return this.vnpayPaymentService_?.completePaymentFromGateway({
      vnp_txn_ref: txnRef,
      amount: this.fromVnpayAmount(body.vnp_Amount),
      response_code: body.vnp_ResponseCode,
      transaction_status: body.vnp_TransactionStatus,
      message: body.vnp_ResponseCode,
      transaction_no: body.vnp_TransactionNo,
      bank_code: body.vnp_BankCode,
      bank_tran_no: body.vnp_BankTranNo,
      card_type: body.vnp_CardType,
      pay_date: body.vnp_PayDate,
      raw_payload: {
        ...withoutVnpayHashParams(body),
        vnp_SecureHash: "[masked]",
      },
      signature_valid: signatureValid,
      event_key: eventKey,
    }) ?? {
      status: "not_found" as const,
      process_payment: false,
      reason: "VNPay payment module is not registered",
    }
  }

  private getWebhookBody(payload: ProviderWebhookPayload["payload"]) {
    const data = payload.data

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {}
    }

    return data as VnpayGatewayPayload
  }

  private getSessionId(data?: Record<string, unknown>) {
    const sessionId = data?.session_id

    return typeof sessionId === "string" ? sessionId : undefined
  }

  private getTxnRef(data?: Record<string, unknown>) {
    const txnRef = data?.vnp_txn_ref ?? data?.provider_session_id ?? data?.id

    return typeof txnRef === "string" ? txnRef : undefined
  }

  private getExpiresAt() {
    const expiresAt = new Date()
    expiresAt.setMinutes(
      expiresAt.getMinutes() +
        (this.options_.paymentExpiryMinutes ?? DEFAULT_EXPIRY_MINUTES)
    )

    return expiresAt
  }

  private assertVndPayment(amount: number, currencyCode: string) {
    if (!Number.isInteger(amount) || amount < 1000) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "VNPay amount must be an integer and at least 1000 VND"
      )
    }

    if (currencyCode !== "vnd") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "VNPay only supports VND payments in this provider"
      )
    }
  }

  private fromVnpayAmount(amount?: string) {
    const parsed = Number(amount)

    return Number.isFinite(parsed) ? parsed / 100 : 0
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

export default VnpayPaymentProviderService
