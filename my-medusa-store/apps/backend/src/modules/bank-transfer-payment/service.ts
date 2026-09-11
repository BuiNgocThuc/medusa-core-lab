import { MedusaError, MedusaService } from "@medusajs/framework/utils"

import BankPaymentReference from "./models/bank-payment-reference"
import BankTransaction from "./models/bank-transaction"
import BankWebhookEvent from "./models/bank-webhook-event"
import type {
  BankPaymentReferenceStatus,
  BankTransactionStatus,
  MatchIncomingTransferInput,
  MatchIncomingTransferResult,
  UpsertReferenceInput,
} from "./types"

type GeneratedModuleMethods = {
  createBankPaymentReferences(data: Record<string, unknown>): Promise<any>
  updateBankPaymentReferences(data: Record<string, unknown>): Promise<any>
  listBankPaymentReferences(
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<any[]>
  createBankTransactions(data: Record<string, unknown>): Promise<any>
  listBankTransactions(
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<any[]>
  createBankWebhookEvents(data: Record<string, unknown>): Promise<any>
  updateBankWebhookEvents(data: Record<string, unknown>): Promise<any>
}

class BankTransferPaymentModuleService extends MedusaService({
  BankPaymentReference,
  BankTransaction,
  BankWebhookEvent,
}) {
  async upsertReferenceFromSession(input: UpsertReferenceInput) {
    const methods = this.methods()
    const [existing] = await methods.listBankPaymentReferences(
      {
        payment_session_id: input.payment_session_id,
      },
      { take: 1 }
    )

    const data = {
      payment_reference: this.normalizeReference(input.payment_reference),
      payment_session_id: input.payment_session_id,
      provider_id: input.provider_id,
      expected_amount: input.expected_amount,
      currency_code: input.currency_code.toLowerCase(),
      status: "pending" satisfies BankPaymentReferenceStatus,
      expires_at: input.expires_at,
      metadata: input.metadata ?? {},
    }

    if (existing) {
      return methods.updateBankPaymentReferences({
        id: existing.id,
        ...data,
      })
    }

    return methods.createBankPaymentReferences(data)
  }

  async matchIncomingTransfer(
    input: MatchIncomingTransferInput
  ): Promise<MatchIncomingTransferResult> {
    const methods = this.methods()
    const receivedAt = input.received_at ?? new Date()
    const transactionId = input.transaction_id.trim()

    if (!transactionId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Bank transfer transaction_id is required"
      )
    }

    const event = await methods.createBankWebhookEvents({
      event_id: input.event_id ?? null,
      external_transaction_id: transactionId,
      status: "received",
      raw_payload: input.raw_payload,
      headers: input.headers ?? null,
    })

    const [duplicate] = await methods.listBankTransactions(
      {
        external_transaction_id: transactionId,
      },
      { take: 1 }
    )

    if (duplicate) {
      await methods.updateBankWebhookEvents({
        id: event.id,
        status: "ignored",
        error_message: "Duplicate bank transaction",
        processed_at: new Date(),
      })

      return {
        status: "duplicate",
        process_payment: false,
        payment_session_id: duplicate.payment_session_id,
        amount: duplicate.amount,
        payment_reference: duplicate.payment_reference,
        reason: "Transaction was already processed",
      }
    }

    const paymentReference = this.normalizeReference(
      input.payment_reference || this.extractReference(input.description)
    )

    const reference = paymentReference
      ? await this.findReference(paymentReference)
      : undefined

    if (!reference) {
      await this.recordTransaction({
        input,
        paymentReference: paymentReference || null,
        status: "unmatched",
        receivedAt,
      })
      await this.markEventProcessed(event.id)

      return {
        status: "unmatched",
        process_payment: false,
        payment_reference: paymentReference || undefined,
        reason: "No pending payment reference matched the transfer",
      }
    }

    const status = this.getMatchStatus(reference, input)

    await this.recordTransaction({
      input,
      paymentReference: reference.payment_reference,
      paymentSessionId: reference.payment_session_id,
      status,
      receivedAt,
    })

    if (status !== "ignored") {
      await methods.updateBankPaymentReferences({
        id: reference.id,
        status: this.toReferenceStatus(status),
        matched_transaction_id: transactionId,
        received_amount: input.amount,
        matched_at: new Date(),
      })
    }

    await this.markEventProcessed(event.id)

    return {
      status,
      process_payment: status === "matched",
      payment_session_id: reference.payment_session_id,
      amount: input.amount,
      payment_reference: reference.payment_reference,
      reason:
        status === "matched"
          ? undefined
          : `Transfer marked as ${status}; payment requires manual review`,
    }
  }

  async expirePendingReferences(now = new Date()) {
    const methods = this.methods()
    const pendingReferences = await methods.listBankPaymentReferences({
      status: "pending",
    })
    const expired = pendingReferences.filter(
      (reference) => new Date(reference.expires_at).getTime() <= now.getTime()
    )

    await Promise.all(
      expired.map((reference) =>
        methods.updateBankPaymentReferences({
          id: reference.id,
          status: "expired",
        })
      )
    )

    return expired.length
  }

  async retrieveReferenceByPaymentSessionId(paymentSessionId: string) {
    const [reference] = await this.methods().listBankPaymentReferences(
      {
        payment_session_id: paymentSessionId,
      },
      { take: 1 }
    )

    return reference
  }

  private async findReference(paymentReference: string) {
    const [reference] = await this.methods().listBankPaymentReferences(
      {
        payment_reference: paymentReference,
      },
      { take: 1 }
    )

    return reference
  }

  private getMatchStatus(
    reference: any,
    input: MatchIncomingTransferInput
  ): BankTransactionStatus {
    if (reference.status !== "pending") {
      return "ignored"
    }

    if (new Date(reference.expires_at).getTime() < Date.now()) {
      return "expired"
    }

    if (reference.currency_code !== input.currency_code.toLowerCase()) {
      return "unmatched"
    }

    if (input.amount < reference.expected_amount) {
      return "underpaid"
    }

    if (input.amount > reference.expected_amount) {
      return "overpaid"
    }

    return "matched"
  }

  private toReferenceStatus(
    status: BankTransactionStatus
  ): BankPaymentReferenceStatus {
    if (
      status === "matched" ||
      status === "underpaid" ||
      status === "overpaid" ||
      status === "expired"
    ) {
      return status
    }

    return "manual_review"
  }

  private async recordTransaction({
    input,
    paymentReference,
    paymentSessionId,
    status,
    receivedAt,
  }: {
    input: MatchIncomingTransferInput
    paymentReference?: string | null
    paymentSessionId?: string
    status: BankTransactionStatus
    receivedAt: Date
  }) {
    return this.methods().createBankTransactions({
      external_transaction_id: input.transaction_id,
      payment_reference: paymentReference ?? null,
      payment_session_id: paymentSessionId ?? null,
      amount: input.amount,
      currency_code: input.currency_code.toLowerCase(),
      description: input.description ?? null,
      status,
      raw_payload: input.raw_payload,
      received_at: receivedAt,
      processed_at: new Date(),
    })
  }

  private async markEventProcessed(eventId: string) {
    return this.methods().updateBankWebhookEvents({
      id: eventId,
      status: "processed",
      processed_at: new Date(),
    })
  }

  private extractReference(description?: string) {
    if (!description) {
      return ""
    }

    const prefix = (process.env.BANK_TRANSFER_REFERENCE_PREFIX || "PAY")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const match = description
      .toUpperCase()
      .match(new RegExp(`\\b${escapedPrefix}\\s+[A-Z0-9]{6,16}\\b`))

    return match?.[0] ?? ""
  }

  private normalizeReference(reference?: string) {
    return (reference ?? "").trim().toUpperCase().replace(/\s+/g, " ")
  }

  private methods() {
    return this as unknown as GeneratedModuleMethods
  }
}

export default BankTransferPaymentModuleService
