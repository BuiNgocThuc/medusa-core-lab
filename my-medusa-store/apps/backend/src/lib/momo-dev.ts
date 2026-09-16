import { MedusaError } from "@medusajs/framework/utils"

import type { MomoProviderOptions } from "../modules/momo/types"

const DEFAULT_ENDPOINT = "https://test-payment.momo.vn"
const DEFAULT_PROVIDER_ID = "pp_momo_default"

export function getMomoDevOptions(): MomoProviderOptions {
  const realConfigured = Boolean(
    process.env.MOMO_PARTNER_CODE &&
      process.env.MOMO_ACCESS_KEY &&
      process.env.MOMO_SECRET_KEY &&
      process.env.MOMO_REDIRECT_URL &&
      process.env.MOMO_IPN_URL
  )
  const mockEnabled =
    process.env.MOMO_MOCK_ENABLED === "true" ||
    (process.env.NODE_ENV !== "production" &&
      process.env.MOMO_MOCK_ENABLED !== "false" &&
      !realConfigured)

  if (!mockEnabled && !realConfigured) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "MoMo sandbox requires MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY, MOMO_REDIRECT_URL, and MOMO_IPN_URL"
    )
  }

  return {
    providerId: process.env.MOMO_PROVIDER_ID || DEFAULT_PROVIDER_ID,
    partnerCode: process.env.MOMO_PARTNER_CODE || "MOMO_MOCK_PARTNER",
    accessKey: process.env.MOMO_ACCESS_KEY || "MOMO_MOCK_ACCESS",
    secretKey: process.env.MOMO_SECRET_KEY || "MOMO_MOCK_SECRET",
    endpoint: process.env.MOMO_ENDPOINT || DEFAULT_ENDPOINT,
    partnerName: process.env.MOMO_PARTNER_NAME || "Medusa Store",
    storeId: process.env.MOMO_STORE_ID || "MedusaStore",
    redirectUrl:
      process.env.MOMO_REDIRECT_URL ||
      "http://localhost:8000/api/payment-return/momo",
    ipnUrl:
      process.env.MOMO_IPN_URL ||
      "http://localhost:9001/hooks/payment/momo_default",
    requestType: "captureWallet",
    autoCapture: process.env.MOMO_AUTO_CAPTURE !== "false",
    lang: (process.env.MOMO_LANG || "vi") as "vi" | "en",
    orderExpireTimeMinutes: Number(process.env.MOMO_ORDER_EXPIRE_MINUTES || 15),
    mockEnabled,
  }
}

export function maskMomoRequest(request: Record<string, unknown>) {
  return {
    ...request,
    signature: "[masked]",
  }
}

export function encodeMomoExtraData(data: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(data)).toString("base64")
}

export function getMomoExpiresAt(minutes: number) {
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + minutes)

  return expiresAt
}
