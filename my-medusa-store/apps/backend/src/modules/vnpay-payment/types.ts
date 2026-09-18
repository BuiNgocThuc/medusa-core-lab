export type VnpayPaymentStatus =
  | "initiated"
  | "pending"
  | "paid"
  | "failed"
  | "canceled"
  | "expired"
  | "refunded"
  | "partially_refunded"
  | "manual_review"

export type VnpayWebhookProcessingStatus =
  | "received"
  | "processed"
  | "duplicate"
  | "ignored"
  | "failed"

export type UpsertVnpayPaymentInput = {
  payment_session_id: string
  cart_id?: string
  order_id?: string
  provider_id: string
  vnp_txn_ref: string
  amount: number
  currency_code: string
  status?: VnpayPaymentStatus
  payment_url?: string
  expires_at?: Date
  raw_create_params?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type CompleteVnpayPaymentInput = {
  vnp_txn_ref: string
  amount: number
  response_code?: string
  transaction_status?: string
  message?: string
  transaction_no?: string
  bank_code?: string
  bank_tran_no?: string
  card_type?: string
  pay_date?: string
  raw_payload: Record<string, unknown>
  signature_valid: boolean
  event_key: string
}

export type CompleteVnpayPaymentResult = {
  status:
    | "paid"
    | "failed"
    | "pending"
    | "duplicate"
    | "manual_review"
    | "not_found"
  process_payment: boolean
  payment_session_id?: string
  amount?: number
  reason?: string
}
