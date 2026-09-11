export type BankPaymentReferenceStatus =
  | "pending"
  | "matched"
  | "underpaid"
  | "overpaid"
  | "expired"
  | "canceled"
  | "manual_review"

export type BankTransactionStatus =
  | "matched"
  | "duplicate"
  | "underpaid"
  | "overpaid"
  | "unmatched"
  | "expired"
  | "failed"
  | "ignored"

export type UpsertReferenceInput = {
  payment_reference: string
  payment_session_id: string
  provider_id: string
  expected_amount: number
  currency_code: string
  expires_at: Date
  metadata?: Record<string, unknown>
}

export type MatchIncomingTransferInput = {
  event_id?: string
  transaction_id: string
  amount: number
  currency_code: string
  description?: string
  payment_reference?: string
  raw_payload: Record<string, unknown>
  headers?: Record<string, string>
  received_at?: Date
}

export type MatchIncomingTransferResult = {
  status: BankTransactionStatus
  process_payment: boolean
  payment_session_id?: string
  amount?: number
  payment_reference?: string
  reason?: string
}
