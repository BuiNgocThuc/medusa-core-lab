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
import { randomBytes, timingSafeEqual } from "crypto"

import {
  BANK_TRANSFER_PAYMENT_MODULE,
} from "../bank-transfer-payment"
import BankTransferPaymentModuleService from "../bank-transfer-payment/service"
import type {
  BankTransferProviderOptions,
  BankTransferSessionData,
  BankTransferWebhookPayload,
} from "./types"

type InjectedDependencies = {
  logger: Logger
  [BANK_TRANSFER_PAYMENT_MODULE]?: BankTransferPaymentModuleService
}

const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
const DEFAULT_REFERENCE_PREFIX = "PAY"
const DEFAULT_EXPIRY_MINUTES = 30

class BankTransferPaymentProviderService extends AbstractPaymentProvider<BankTransferProviderOptions> {
  static identifier = "bank-transfer"

  protected readonly logger_: Logger
  protected readonly options_: BankTransferProviderOptions
  protected readonly bankTransferPaymentService_?: BankTransferPaymentModuleService

  constructor(
    container: InjectedDependencies,
    options: BankTransferProviderOptions
  ) {
    super(container, options)

    this.logger_ = container.logger
    this.bankTransferPaymentService_ = container[BANK_TRANSFER_PAYMENT_MODULE]
    this.options_ = {
      referencePrefix: DEFAULT_REFERENCE_PREFIX,
      paymentExpiryMinutes: DEFAULT_EXPIRY_MINUTES,
      ...options,
    }
  }

  static validateOptions(options: Record<string, unknown>) {
    for (const key of ["bankName", "accountNumber", "accountName"]) {
      if (!options[key]) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Bank Transfer provider option "${key}" is required`
        )
      }
    }
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    const sessionId = this.getSessionId(input.data)

    if (!sessionId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Bank Transfer requires the Medusa payment session id"
      )
    }

    const paymentReference = this.generatePaymentReference()
    const expiresAt = this.getExpiresAt()
    const amount = this.toNumber(input.amount)
    const currencyCode = input.currency_code.toLowerCase()

    const data: BankTransferSessionData = {
      id: paymentReference,
      session_id: sessionId,
      provider_session_id: paymentReference,
      payment_reference: paymentReference,
      bank_name: this.options_.bankName,
      bank_account_number: this.options_.accountNumber,
      bank_account_name: this.options_.accountName,
      amount,
      currency_code: currencyCode,
      expires_at: expiresAt,
      instructions: `Transfer exactly ${amount} ${currencyCode.toUpperCase()} with content: ${paymentReference}`,
    }

    await this.bankTransferPaymentService_?.upsertReferenceFromSession({
      payment_reference: paymentReference,
      payment_session_id: sessionId,
      provider_id: this.options_.providerId ?? "pp_bank-transfer_default",
      expected_amount: amount,
      currency_code: currencyCode,
      expires_at: new Date(expiresAt),
      metadata: {
        provider_session_id: paymentReference,
      },
    })

    this.logger_.info(
      `Created bank transfer payment reference ${paymentReference} for session ${sessionId}`
    )

    return {
      id: paymentReference,
      status: "pending",
      data,
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const sessionId = this.getSessionId(input.data)
    const matchedReference = sessionId
      ? await this.bankTransferPaymentService_?.retrieveReferenceByPaymentSessionId(
          sessionId
        )
      : undefined

    if (matchedReference?.status === "matched") {
      return {
        status: "authorized",
        data: {
          ...input.data,
          external_transaction_id: matchedReference.matched_transaction_id,
          confirmed_amount: matchedReference.received_amount,
          confirmed_currency_code: matchedReference.currency_code,
          confirmed_reference: matchedReference.payment_reference,
          confirmed_at:
            matchedReference.matched_at?.toISOString?.() ??
            matchedReference.matched_at,
        },
      }
    }

    return {
      status: "pending_authorization",
      data: input.data,
    }
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
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

  async cancelPayment(
    input: CancelPaymentInput
  ): Promise<CancelPaymentOutput> {
    return {
      data: {
        ...input.data,
        canceled_at: new Date().toISOString(),
      },
    }
  }

  async deletePayment(
    input: DeletePaymentInput
  ): Promise<DeletePaymentOutput> {
    return {
      data: {
        ...input.data,
        deleted_at: new Date().toISOString(),
      },
    }
  }

  async updatePayment(
    input: UpdatePaymentInput
  ): Promise<UpdatePaymentOutput> {
    const sessionId = this.getSessionId(input.data)
    const amount = this.toNumber(input.amount)
    const currencyCode = input.currency_code.toLowerCase()
    const paymentReference = this.getPaymentReference(input.data)

    if (sessionId) {
      await this.bankTransferPaymentService_?.updateReferenceFromSession({
        payment_session_id: sessionId,
        expected_amount: amount,
        currency_code: currencyCode,
        metadata: {
          updated_from_payment_session: true,
        },
      })
    }

    return {
      status: "pending",
      data: {
        ...input.data,
        amount,
        currency_code: currencyCode,
        instructions: paymentReference
          ? `Transfer exactly ${amount} ${currencyCode.toUpperCase()} with content: ${paymentReference}`
          : input.data?.instructions,
        updated_at: new Date().toISOString(),
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
    const matchedReference = sessionId
      ? await this.bankTransferPaymentService_?.retrieveReferenceByPaymentSessionId(
          sessionId
        )
      : undefined

    if (matchedReference?.status === "matched") {
      return {
        status: "authorized",
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

    this.assertValidWebhookSecret(payload)

    const transactionId = body.transaction_id?.trim()
    const amount = this.toWebhookAmount(body.amount)
    const currencyCode = body.currency_code?.toLowerCase()

    if (
      body.event_type === "bank_transfer.failed" &&
      body.session_id &&
      amount
    ) {
      return {
        action: "failed",
        data: {
          session_id: body.session_id,
          amount,
        },
      }
    }

    if (
      !this.bankTransferPaymentService_ ||
      !transactionId ||
      !amount ||
      !currencyCode
    ) {
      return {
        action: "not_supported",
      }
    }

    const match = await this.bankTransferPaymentService_.matchIncomingTransfer({
      event_id: body.event_id,
      transaction_id: transactionId,
      amount,
      currency_code: currencyCode,
      description: body.description,
      payment_reference: body.payment_reference,
      raw_payload: body as Record<string, unknown>,
      headers: this.stringifyHeaders(payload.headers),
    })

    if (!match.process_payment || !match.payment_session_id || !match.amount) {
      return {
        action: "not_supported",
        data: match.payment_session_id
          ? {
              session_id: match.payment_session_id,
              amount: match.amount ?? amount,
            }
          : undefined,
      }
    }

    return {
      action: "authorized",
      data: {
        session_id: match.payment_session_id,
        amount: match.amount,
      },
    }
  }

  private generatePaymentReference() {
    const prefix = this.normalizeReferencePrefix(
      this.options_.referencePrefix ?? DEFAULT_REFERENCE_PREFIX
    )

    return `${prefix} ${this.randomReferenceCode(9)}`
  }

  private randomReferenceCode(length: number) {
    const bytes = randomBytes(length)

    return Array.from(bytes)
      .map((byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length])
      .join("")
  }

  private normalizeReferencePrefix(prefix: string) {
    return prefix
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8)
  }

  private getExpiresAt() {
    const expiresAt = new Date()
    expiresAt.setMinutes(
      expiresAt.getMinutes() +
        (this.options_.paymentExpiryMinutes ?? DEFAULT_EXPIRY_MINUTES)
    )

    return expiresAt.toISOString()
  }

  private getSessionId(data?: Record<string, unknown>) {
    const sessionId = data?.session_id

    return typeof sessionId === "string" ? sessionId : undefined
  }

  private getPaymentReference(data?: Record<string, unknown>) {
    const paymentReference = data?.payment_reference

    return typeof paymentReference === "string" ? paymentReference : undefined
  }

  private getWebhookBody(
    payload: ProviderWebhookPayload["payload"]
  ): BankTransferWebhookPayload {
    const data = payload.data

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {}
    }

    return data as BankTransferWebhookPayload
  }

  private assertValidWebhookSecret(payload: ProviderWebhookPayload["payload"]) {
    if (!this.options_.webhookSecret) {
      return
    }

    const signature = this.readHeader(payload.headers, "x-bank-signature")

    if (!signature) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Missing bank transfer webhook signature"
      )
    }

    const expected = Buffer.from(this.options_.webhookSecret)
    const received = Buffer.from(signature)

    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Invalid bank transfer webhook signature"
      )
    }
  }

  private readHeader(
    headers: ProviderWebhookPayload["payload"]["headers"],
    key: string
  ) {
    const value = headers[key] ?? headers[key.toLowerCase()]

    if (Array.isArray(value)) {
      return value[0]
    }

    return value
  }

  private stringifyHeaders(
    headers: ProviderWebhookPayload["payload"]["headers"]
  ) {
    return Object.entries(headers ?? {}).reduce<Record<string, string>>(
      (result, [key, value]) => {
        result[key] = Array.isArray(value)
          ? value.join(",")
          : value?.toString() ?? ""

        return result
      },
      {}
    )
  }

  private toWebhookAmount(value: unknown) {
    if (value === undefined || value === null || value === "") {
      return 0
    }

    try {
      const amount = this.toNumber(value)

      return Number.isFinite(amount) ? amount : 0
    } catch {
      return 0
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

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Invalid bank transfer amount: ${String(value)}`
    )
  }
}

export default BankTransferPaymentProviderService
