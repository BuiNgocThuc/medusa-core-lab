import { MedusaService } from "@medusajs/framework/utils"

import VnpayPayment from "./models/vnpay-payment"
import VnpayRefund from "./models/vnpay-refund"
import VnpayWebhookEvent from "./models/vnpay-webhook-event"
import type {
  CompleteVnpayPaymentInput,
  CompleteVnpayPaymentResult,
  CreateVnpayRefundInput,
  UpdateVnpayRefundInput,
  UpsertVnpayPaymentInput,
  VnpayRefundStatus,
  VnpayPaymentStatus,
} from "./types"

type GeneratedModuleMethods = {
  createVnpayPayments(data: Record<string, unknown>): Promise<any>
  updateVnpayPayments(data: Record<string, unknown>): Promise<any>
  listVnpayPayments(
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<any[]>
  createVnpayWebhookEvents(data: Record<string, unknown>): Promise<any>
  listVnpayWebhookEvents(
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<any[]>
  updateVnpayWebhookEvents(data: Record<string, unknown>): Promise<any>
  createVnpayRefunds(data: Record<string, unknown>): Promise<any>
  updateVnpayRefunds(data: Record<string, unknown>): Promise<any>
  listVnpayRefunds(
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<any[]>
}

class VnpayPaymentModuleService extends MedusaService({
  VnpayPayment,
  VnpayWebhookEvent,
  VnpayRefund,
}) {
  async upsertPaymentFromSession(input: UpsertVnpayPaymentInput) {
    const methods = this.methods()
    const [existing] = await methods.listVnpayPayments(
      {
        payment_session_id: input.payment_session_id,
      },
      { take: 1 }
    )

    const data = {
      payment_session_id: input.payment_session_id,
      cart_id: input.cart_id ?? null,
      order_id: input.order_id ?? null,
      provider_id: input.provider_id,
      vnp_txn_ref: input.vnp_txn_ref,
      amount: input.amount,
      currency_code: input.currency_code.toLowerCase(),
      status: input.status ?? ("pending" satisfies VnpayPaymentStatus),
      payment_url: input.payment_url ?? null,
      expires_at: input.expires_at ?? null,
      raw_create_params: input.raw_create_params ?? null,
      metadata: input.metadata ?? {},
    }

    if (existing && !this.isFinalStatus(existing.status)) {
      return methods.updateVnpayPayments({
        id: existing.id,
        ...data,
      })
    }

    if (existing) {
      return existing
    }

    return methods.createVnpayPayments(data)
  }

  async retrievePaymentBySessionId(paymentSessionId: string) {
    const [payment] = await this.methods().listVnpayPayments(
      {
        payment_session_id: paymentSessionId,
      },
      { take: 1 }
    )

    return payment
  }

  async retrievePaymentByTxnRef(txnRef: string) {
    const [payment] = await this.methods().listVnpayPayments(
      {
        vnp_txn_ref: txnRef,
      },
      { take: 1 }
    )

    return payment
  }

  async completePaymentFromGateway(
    input: CompleteVnpayPaymentInput
  ): Promise<CompleteVnpayPaymentResult> {
    const methods = this.methods()
    const [existingEvent] = await methods.listVnpayWebhookEvents(
      {
        event_key: input.event_key,
      },
      { take: 1 }
    )

    if (existingEvent) {
      return {
        status: "duplicate",
        process_payment: false,
        reason: "VNPay event was already processed",
      }
    }

    const payment = await this.retrievePaymentByTxnRef(input.vnp_txn_ref)
    const event = await methods.createVnpayWebhookEvents({
      vnpay_payment_id: payment?.id ?? null,
      event_key: input.event_key,
      txn_ref: input.vnp_txn_ref,
      transaction_no: input.transaction_no ?? null,
      response_code: input.response_code ?? null,
      transaction_status: input.transaction_status ?? null,
      signature_valid: input.signature_valid,
      processing_status: "received",
      raw_payload: input.raw_payload,
    })

    if (!input.signature_valid) {
      await this.markEvent(event.id, "failed", "Invalid VNPay signature")

      return {
        status: "manual_review",
        process_payment: false,
        reason: "Invalid VNPay signature",
      }
    }

    if (!payment) {
      await this.markEvent(event.id, "ignored", "Unknown VNPay txnRef")

      return {
        status: "not_found",
        process_payment: false,
        reason: "Unknown VNPay txnRef",
      }
    }

    if (payment.amount !== input.amount) {
      await this.markPaymentAndEvent(
        payment,
        event.id,
        "manual_review",
        "VNPay amount mismatch",
        input
      )

      return {
        status: "manual_review",
        process_payment: false,
        payment_session_id: payment.payment_session_id,
        amount: payment.amount,
        reason: "VNPay amount mismatch",
      }
    }

    if (this.isFinalSuccess(payment.status)) {
      await this.markEvent(event.id, "duplicate", "VNPay payment already final")

      return {
        status: "duplicate",
        process_payment: false,
        payment_session_id: payment.payment_session_id,
        amount: payment.amount,
        reason: "VNPay payment already final",
      }
    }

    if (
      input.response_code === "00" &&
      (input.transaction_status === "00" || !input.transaction_status)
    ) {
      await this.markPaymentAndEvent(payment, event.id, "paid", undefined, input)

      return {
        status: "paid",
        process_payment: true,
        payment_session_id: payment.payment_session_id,
        amount: payment.amount,
      }
    }

    await this.markPaymentAndEvent(payment, event.id, "failed", undefined, input)

    return {
      status: "failed",
      process_payment: false,
      payment_session_id: payment.payment_session_id,
      amount: payment.amount,
      reason: input.message ?? "VNPay payment failed",
    }
  }

  async createRefund(input: CreateVnpayRefundInput) {
    return this.methods().createVnpayRefunds({
      vnpay_payment_id: input.vnpay_payment_id,
      payment_id: input.payment_id ?? null,
      request_id: input.request_id,
      txn_ref: input.txn_ref,
      amount: input.amount,
      transaction_type: input.transaction_type,
      status: "pending",
      raw_request: input.raw_request ?? null,
    })
  }

  async updateRefundFromResponse(input: UpdateVnpayRefundInput) {
    const [refund] = await this.methods().listVnpayRefunds(
      {
        request_id: input.request_id,
      },
      { take: 1 }
    )

    if (!refund) {
      return
    }

    return this.methods().updateVnpayRefunds({
      id: refund.id,
      status: input.status,
      response_code: input.response_code ?? null,
      transaction_status: input.transaction_status ?? null,
      message: input.message ?? null,
      refund_transaction_no: input.refund_transaction_no ?? null,
      raw_response: input.raw_response ?? null,
      processed_at: new Date(),
    })
  }

  async sumRefundAmount(
    vnpayPaymentId: string,
    statuses: VnpayRefundStatus[] = ["processing", "succeeded"]
  ) {
    const refunds = await this.methods().listVnpayRefunds(
      {
        vnpay_payment_id: vnpayPaymentId,
        status: statuses,
      },
      { take: 1000 }
    )

    return refunds.reduce((total, refund) => total + Number(refund.amount ?? 0), 0)
  }

  async markRefundedStatus(paymentId: string, refundedAmount: number) {
    const [payment] = await this.methods().listVnpayPayments(
      {
        id: paymentId,
      },
      { take: 1 }
    )

    if (!payment) {
      return
    }

    const status =
      refundedAmount >= Number(payment.amount ?? 0)
        ? "refunded"
        : "partially_refunded"

    return this.methods().updateVnpayPayments({
      id: paymentId,
      status,
    })
  }

  async listRefundsForPayment(vnpayPaymentId: string) {
    return this.methods().listVnpayRefunds(
      {
        vnpay_payment_id: vnpayPaymentId,
      },
      {
        take: 100,
        order: {
          created_at: "DESC",
        },
      }
    )
  }

  private async markPaymentAndEvent(
    payment: any,
    eventId: string,
    status: VnpayPaymentStatus,
    errorMessage: string | undefined,
    input: CompleteVnpayPaymentInput
  ) {
    await this.methods().updateVnpayPayments({
      id: payment.id,
      status,
      response_code: input.response_code ?? null,
      transaction_status: input.transaction_status ?? null,
      message: input.message ?? null,
      transaction_no: input.transaction_no ?? payment.transaction_no ?? null,
      bank_code: input.bank_code ?? payment.bank_code ?? null,
      bank_tran_no: input.bank_tran_no ?? payment.bank_tran_no ?? null,
      card_type: input.card_type ?? payment.card_type ?? null,
      pay_date: input.pay_date ?? payment.pay_date ?? null,
      raw_gateway_payload: input.raw_payload,
      paid_at: status === "paid" ? new Date() : payment.paid_at ?? null,
    })

    await this.markEvent(
      eventId,
      errorMessage ? "failed" : "processed",
      errorMessage
    )
  }

  private async markEvent(
    eventId: string,
    processingStatus: "processed" | "duplicate" | "ignored" | "failed",
    errorMessage?: string
  ) {
    return this.methods().updateVnpayWebhookEvents({
      id: eventId,
      processing_status: processingStatus,
      error_message: errorMessage ?? null,
      processed_at: new Date(),
    })
  }

  private isFinalStatus(status: VnpayPaymentStatus) {
    return [
      "paid",
      "failed",
      "canceled",
      "expired",
      "refunded",
      "partially_refunded",
      "manual_review",
    ].includes(status)
  }

  private isFinalSuccess(status: VnpayPaymentStatus) {
    return ["paid", "refunded", "partially_refunded"].includes(status)
  }

  private methods() {
    return this as unknown as GeneratedModuleMethods
  }
}

export default VnpayPaymentModuleService
