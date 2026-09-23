export type BankTransferProviderOptions = {
  bankName: string
  accountNumber: string
  accountName: string
  providerId?: string
  referencePrefix?: string
  paymentExpiryMinutes?: number
  webhookSecret?: string
}

export type BankTransferSessionData = {
  id: string
  session_id: string
  provider_session_id: string
  payment_reference: string
  bank_name: string
  bank_account_number: string
  bank_account_name: string
  amount: number
  currency_code: string
  expires_at: string
  instructions: string
}

export type BankTransferWebhookPayload = {
  event_id?: string
  event_type?: "bank_transfer.completed" | "bank_transfer.failed" | string
  transaction_id?: string
  session_id?: string
  amount?: number | string
  currency_code?: string
  description?: string
  payment_reference?: string
}
