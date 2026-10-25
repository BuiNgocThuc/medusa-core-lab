export type MomoProviderOptions = {
  partnerCode: string
  accessKey: string
  secretKey: string
  endpoint?: string
  providerId?: string
  storeId?: string
  partnerName?: string
  redirectUrl: string
  ipnUrl: string
  requestType?: "captureWallet" | "payWithMethod"
  autoCapture?: boolean
  lang?: "vi" | "en"
  orderExpireTimeMinutes?: number
}

export type MomoSessionData = {
  id: string
  session_id: string
  provider_session_id: string
  momo_order_id: string
  request_id: string
  amount: number
  currency_code: string
  pay_url?: string
  short_link?: string
  deeplink?: string
  qr_code_url?: string
  deeplink_mini_app?: string
  user_fee?: number
  payment_option?: string
  result_code?: number
  message?: string
  expires_at?: string
}

export type MomoCreatePaymentRequest = {
  partnerCode: string
  partnerName?: string
  storeId?: string
  requestId: string
  amount: number
  orderId: string
  orderInfo: string
  redirectUrl: string
  ipnUrl: string
  requestType: "captureWallet" | "payWithMethod"
  extraData: string
  autoCapture: boolean
  lang: "vi" | "en"
  orderExpireTime?: number
  signature: string
}

export type MomoCreatePaymentResponse = {
  partnerCode?: string
  requestId?: string
  orderId?: string
  amount?: number
  responseTime?: number
  message?: string
  resultCode?: number
  payUrl?: string
  shortLink?: string
  deeplink?: string
  qrCodeUrl?: string
  deeplinkMiniApp?: string
  userFee?: number
  signature?: string
}

export type MomoIpnPayload = {
  partnerCode?: string
  orderId?: string
  requestId?: string
  amount?: number | string
  orderInfo?: string
  partnerUserId?: string
  orderType?: string
  transId?: number | string
  resultCode?: number | string
  message?: string
  payType?: string
  paymentOption?: string
  userFee?: number
  responseTime?: number | string
  extraData?: string
  signature?: string
}

export type MomoQueryRequest = {
  partnerCode: string
  requestId: string
  orderId: string
  lang: "vi" | "en"
  signature: string
}

export type MomoQueryResponse = {
  partnerCode?: string
  requestId?: string
  orderId?: string
  extraData?: string
  amount?: number
  transId?: number | string
  payType?: string
  resultCode?: number
  message?: string
  responseTime?: number
  paymentOption?: string
}

export type MomoRefundRequest = {
  partnerCode: string
  orderId: string
  requestId: string
  amount: number
  transId: number | string
  lang: "vi" | "en"
  description: string
  signature: string
}

export type MomoRefundResponse = {
  partnerCode?: string
  orderId?: string
  requestId?: string
  amount?: number
  transId?: number | string
  resultCode?: number
  message?: string
  responseTime?: number
}
