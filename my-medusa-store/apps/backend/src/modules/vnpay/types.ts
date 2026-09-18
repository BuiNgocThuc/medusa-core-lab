export type VnpayProviderOptions = {
  tmnCode: string
  hashSecret: string
  paymentUrl?: string
  returnUrl: string
  ipnUrl?: string
  providerId?: string
  locale?: "vn" | "en"
  orderType?: string
  command?: "pay"
  version?: string
  paymentExpiryMinutes?: number
}

export type VnpaySessionData = {
  id: string
  session_id: string
  provider_session_id: string
  vnp_txn_ref: string
  amount: number
  currency_code: string
  payment_url: string
  expires_at?: string
}

export type VnpayGatewayPayload = {
  vnp_Amount?: string
  vnp_BankCode?: string
  vnp_BankTranNo?: string
  vnp_CardType?: string
  vnp_OrderInfo?: string
  vnp_PayDate?: string
  vnp_ResponseCode?: string
  vnp_TmnCode?: string
  vnp_TransactionNo?: string
  vnp_TransactionStatus?: string
  vnp_TxnRef?: string
  vnp_SecureHash?: string
  vnp_SecureHashType?: string
  [key: string]: string | undefined
}
