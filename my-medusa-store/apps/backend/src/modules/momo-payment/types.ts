export type MomoPaymentStatus =
  | "initiated"
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "canceled"
  | "expired"
  | "refunded"
  | "partially_refunded"
  | "manual_review"

export type MomoWebhookProcessingStatus =
  | "received"
  | "processed"
  | "duplicate"
  | "ignored"
  | "failed"

export type MomoRefundStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "manual_review"

export type UpsertMomoPaymentInput = {
  payment_session_id: string
  cart_id?: string
  order_id?: string
  provider_id: string
  momo_order_id: string
  request_id: string
  amount: number
  currency_code: string
  status?: MomoPaymentStatus
  pay_url?: string
  short_link?: string
  deeplink?: string
  qr_code_url?: string
  deeplink_mini_app?: string
  user_fee?: number
  expires_at?: Date
  raw_create_request?: Record<string, unknown>
  raw_create_response?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type CompleteMomoPaymentInput = {
  momo_order_id: string
  request_id: string
  amount: number
  result_code: number
  message?: string
  trans_id?: string
  pay_type?: string
  payment_option?: string
  order_type?: string
  user_fee?: number
  raw_payload: Record<string, unknown>
  signature_valid: boolean
  event_key: string
}

export type CompleteMomoPaymentResult = {
  status: "paid" | "authorized" | "failed" | "pending" | "duplicate" | "manual_review" | "not_found"
  process_payment: boolean
  payment_session_id?: string
  amount?: number
  reason?: string
}

export type CreateMomoRefundInput = {
  momo_payment_id: string
  payment_id?: string
  refund_order_id: string
  request_id: string
  amount: number
  raw_request: Record<string, unknown>
}

export type UpdateMomoRefundInput = {
  request_id: string
  status: MomoRefundStatus
  result_code?: number
  message?: string
  refund_trans_id?: string
  raw_response?: Record<string, unknown>
}
