/**
 * Service Ledger/Audit cho MoMo Payment:
 * - Lưu trữ và quản lý bảng momo_payment, momo_webhook_event, momo_refund.
 * - Xử lý complete payment từ IPN callback & idempotency check.
 */
import { MedusaService } from "@medusajs/framework/utils"

import MomoPayment from "./models/momo-payment"
import MomoRefund from "./models/momo-refund"
import MomoWebhookEvent from "./models/momo-webhook-event"
import type {
  CompleteMomoPaymentInput,
  CompleteMomoPaymentResult,
  CreateMomoRefundInput,
  MomoPaymentStatus,
  UpdateMomoRefundInput,
  UpsertMomoPaymentInput,
} from "./types"

type GeneratedModuleMethods = {
  createMomoPayments(data: Record<string, unknown>): Promise<any>
  updateMomoPayments(data: Record<string, unknown>): Promise<any>
  listMomoPayments(
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<any[]>
  createMomoWebhookEvents(data: Record<string, unknown>): Promise<any>
  listMomoWebhookEvents(
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<any[]>
  updateMomoWebhookEvents(data: Record<string, unknown>): Promise<any>
  createMomoRefunds(data: Record<string, unknown>): Promise<any>
  updateMomoRefunds(data: Record<string, unknown>): Promise<any>
  listMomoRefunds(
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<any[]>
}

class MomoPaymentModuleService extends MedusaService({
  MomoPayment,
  MomoWebhookEvent,
  MomoRefund,
}) {
  async upsertPaymentFromSession(input: UpsertMomoPaymentInput) {
    const methods = this.methods()
    const [existing] = await methods.listMomoPayments(
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
      momo_order_id: input.momo_order_id,
      request_id: input.request_id,
      amount: input.amount,
      currency_code: input.currency_code.toLowerCase(),
      status: input.status ?? ("pending" satisfies MomoPaymentStatus),
      pay_url: input.pay_url ?? null,
      short_link: input.short_link ?? null,
      deeplink: input.deeplink ?? null,
      qr_code_url: input.qr_code_url ?? null,
      deeplink_mini_app: input.deeplink_mini_app ?? null,
      user_fee: input.user_fee ?? null,
      expires_at: input.expires_at ?? null,
      raw_create_request: input.raw_create_request ?? null,
      raw_create_response: input.raw_create_response ?? null,
      metadata: input.metadata ?? {},
    }

    if (existing && !this.isFinalStatus(existing.status)) {
      return methods.updateMomoPayments({
        id: existing.id,
        ...data,
      })
    }

    if (existing) {
      return existing
    }

    return methods.createMomoPayments(data)
  }

  async retrievePaymentBySessionId(paymentSessionId: string) {
    const [payment] = await this.methods().listMomoPayments(
      {
        payment_session_id: paymentSessionId,
      },
      { take: 1 }
    )

    return payment
  }

  async retrievePaymentByMomoOrderId(momoOrderId: string) {
    const [payment] = await this.methods().listMomoPayments(
      {
        momo_order_id: momoOrderId,
      },
      { take: 1 }
    )

    return payment
  }

  async completePaymentFromIpn(
    input: CompleteMomoPaymentInput
  ): Promise<CompleteMomoPaymentResult> {
    const methods = this.methods()
    const [existingEvent] = await methods.listMomoWebhookEvents(
      {
        event_key: input.event_key,
      },
      { take: 1 }
    )

    if (existingEvent) {
      return {
        status: "duplicate",
        process_payment: false,
        reason: "MoMo IPN event was already processed",
      }
    }

    const payment = await this.retrievePaymentByMomoOrderId(input.momo_order_id)

    const event = await methods.createMomoWebhookEvents({
      momo_payment_id: payment?.id ?? null,
      event_key: input.event_key,
      order_id: input.momo_order_id,
      request_id: input.request_id,
      trans_id: input.trans_id ?? null,
      result_code: input.result_code,
      signature_valid: input.signature_valid,
      processing_status: "received",
      raw_payload: input.raw_payload,
    })

    if (!input.signature_valid) {
      await this.markEvent(event.id, "failed", "Invalid MoMo IPN signature")

      return {
        status: "manual_review",
        process_payment: false,
        reason: "Invalid MoMo IPN signature",
      }
    }

    if (!payment) {
      await this.markEvent(event.id, "ignored", "Unknown MoMo orderId")

      return {
        status: "not_found",
        process_payment: false,
        reason: "Unknown MoMo orderId",
      }
    }

    if (payment.request_id !== input.request_id) {
      await this.markPaymentAndEvent(
        payment,
        event.id,
        "manual_review",
        "MoMo requestId mismatch",
        input
      )

      return {
        status: "manual_review",
        process_payment: false,
        payment_session_id: payment.payment_session_id,
        amount: payment.amount,
        reason: "MoMo requestId mismatch",
      }
    }

    if (payment.amount !== input.amount) {
      await this.markPaymentAndEvent(
        payment,
        event.id,
        "manual_review",
        "MoMo amount mismatch",
        input
      )

      return {
        status: "manual_review",
        process_payment: false,
        payment_session_id: payment.payment_session_id,
        amount: payment.amount,
        reason: "MoMo amount mismatch",
      }
    }

    if (this.isFinalSuccess(payment.status)) {
      await this.markEvent(event.id, "duplicate", "MoMo payment already final")

      return {
        status: "duplicate",
        process_payment: false,
        payment_session_id: payment.payment_session_id,
        amount: payment.amount,
        reason: "MoMo payment already final",
      }
    }

    if (input.result_code === 0) {
      await this.markPaymentAndEvent(payment, event.id, "paid", undefined, input)

      return {
        status: "paid",
        process_payment: true,
        payment_session_id: payment.payment_session_id,
        amount: payment.amount,
      }
    }

    if (input.result_code === 9000) {
      await this.markPaymentAndEvent(
        payment,
        event.id,
        "authorized",
        undefined,
        input
      )

      return {
        status: "authorized",
        process_payment: true,
        payment_session_id: payment.payment_session_id,
        amount: payment.amount,
      }
    }

    if (this.isPendingResultCode(input.result_code)) {
      await this.markPaymentAndEvent(
        payment,
        event.id,
        "pending",
        undefined,
        input
      )

      return {
        status: "pending",
        process_payment: false,
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
      reason: input.message ?? "MoMo payment failed",
    }
  }

  async markPaymentQueried(paymentId: string) {
    const [existing] = await this.methods().listMomoPayments(
      {
        id: paymentId,
      },
      { take: 1 }
    )
    const payment = await this.methods().updateMomoPayments({
      id: paymentId,
      last_queried_at: new Date(),
      query_count: Number(existing?.query_count ?? 0) + 1,
    })

    return payment
  }

  async listReconciliationCandidates(limit = 50) {
    return this.methods().listMomoPayments(
      {
        status: ["initiated", "pending", "authorized"],
      },
      {
        take: limit,
        order: {
          created_at: "ASC",
        },
      }
    )
  }

  async createRefund(input: CreateMomoRefundInput) {
    return this.methods().createMomoRefunds({
      momo_payment_id: input.momo_payment_id,
      payment_id: input.payment_id ?? null,
      refund_order_id: input.refund_order_id,
      request_id: input.request_id,
      amount: input.amount,
      status: "pending",
      raw_request: input.raw_request,
    })
  }

  async updateRefundFromResponse(input: UpdateMomoRefundInput) {
    const [refund] = await this.methods().listMomoRefunds(
      {
        request_id: input.request_id,
      },
      { take: 1 }
    )

    if (!refund) {
      return
    }

    return this.methods().updateMomoRefunds({
      id: refund.id,
      status: input.status,
      result_code: input.result_code ?? null,
      message: input.message ?? null,
      refund_trans_id: input.refund_trans_id ?? null,
      raw_response: input.raw_response ?? null,
      processed_at: new Date(),
    })
  }

  private async markPaymentAndEvent(
    payment: any,
    eventId: string,
    status: MomoPaymentStatus,
    errorMessage: string | undefined,
    input: CompleteMomoPaymentInput
  ) {
    await this.methods().updateMomoPayments({
      id: payment.id,
      status,
      result_code: input.result_code,
      message: input.message ?? null,
      trans_id: input.trans_id ?? payment.trans_id ?? null,
      pay_type: input.pay_type ?? payment.pay_type ?? null,
      payment_option: input.payment_option ?? payment.payment_option ?? null,
      order_type: input.order_type ?? payment.order_type ?? null,
      user_fee: input.user_fee ?? payment.user_fee ?? null,
      paid_at:
        status === "paid" || status === "authorized"
          ? new Date()
          : payment.paid_at ?? null,
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
    return this.methods().updateMomoWebhookEvents({
      id: eventId,
      processing_status: processingStatus,
      error_message: errorMessage ?? null,
      processed_at: new Date(),
    })
  }

  private isFinalStatus(status: MomoPaymentStatus) {
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

  private isFinalSuccess(status: MomoPaymentStatus) {
    return ["paid", "refunded", "partially_refunded"].includes(status)
  }

  private isPendingResultCode(resultCode: number) {
    return [1000, 7000, 7002].includes(resultCode)
  }

  private methods() {
    return this as unknown as GeneratedModuleMethods
  }
}

export default MomoPaymentModuleService
