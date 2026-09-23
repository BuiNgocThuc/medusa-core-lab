/**
 * Client giao tiếp API MoMo Gateway:
 * - Gửi API create payment (/v2/gateway/api/create), query status (/v2/gateway/api/query) và refund (/v2/gateway/api/refund).
 */
import { MedusaError } from "@medusajs/framework/utils"

import {
  buildCreatePaymentSignatureData,
  buildQuerySignatureData,
  buildRefundSignatureData,
  signMomoPayload,
} from "./crypto"
import type {
  MomoCreatePaymentRequest,
  MomoCreatePaymentResponse,
  MomoProviderOptions,
  MomoQueryRequest,
  MomoQueryResponse,
  MomoRefundRequest,
  MomoRefundResponse,
} from "./types"

const DEFAULT_MOMO_ENDPOINT = "https://test-payment.momo.vn"

export class MomoClient {
  private readonly options_: Required<
    Pick<
      MomoProviderOptions,
      "partnerCode" | "accessKey" | "secretKey" | "redirectUrl" | "ipnUrl"
    >
  > &
    MomoProviderOptions

  constructor(options: MomoProviderOptions) {
    this.options_ = {
      endpoint: DEFAULT_MOMO_ENDPOINT,
      requestType: "payWithMethod",
      autoCapture: true,
      lang: "vi",
      ...options,
    }
  }

  async createPayment(input: {
    orderId: string
    requestId: string
    amount: number
    orderInfo: string
    extraData?: string
  }) {
    const extraData = input.extraData ?? ""
    const requestType = this.options_.requestType ?? "payWithMethod"
    const rawSignatureData = buildCreatePaymentSignatureData({
      accessKey: this.options_.accessKey,
      amount: input.amount,
      extraData,
      ipnUrl: this.options_.ipnUrl,
      orderId: input.orderId,
      orderInfo: input.orderInfo,
      partnerCode: this.options_.partnerCode,
      redirectUrl: this.options_.redirectUrl,
      requestId: input.requestId,
      requestType,
    })

    const body: MomoCreatePaymentRequest = {
      partnerCode: this.options_.partnerCode,
      partnerName: this.options_.partnerName,
      storeId: this.options_.storeId,
      requestId: input.requestId,
      amount: input.amount,
      orderId: input.orderId,
      orderInfo: input.orderInfo,
      redirectUrl: this.options_.redirectUrl,
      ipnUrl: this.options_.ipnUrl,
      requestType,
      extraData,
      autoCapture: this.options_.autoCapture ?? true,
      lang: this.options_.lang ?? "vi",
      orderExpireTime: this.options_.orderExpireTimeMinutes,
      signature: signMomoPayload(rawSignatureData, this.options_.secretKey),
    }

    return {
      request: body,
      response: await this.post<MomoCreatePaymentResponse>(
        "/v2/gateway/api/create",
        body
      ),
    }
  }

  async queryPayment(input: { orderId: string; requestId: string; amount?: number }) {
    const rawSignatureData = buildQuerySignatureData({
      accessKey: this.options_.accessKey,
      orderId: input.orderId,
      partnerCode: this.options_.partnerCode,
    })
    const body: MomoQueryRequest = {
      partnerCode: this.options_.partnerCode,
      requestId: input.requestId,
      orderId: input.orderId,
      lang: this.options_.lang ?? "vi",
      signature: signMomoPayload(rawSignatureData, this.options_.secretKey),
    }

    return this.post<MomoQueryResponse>("/v2/gateway/api/query", body)
  }

  async refund(input: {
    orderId: string
    requestId: string
    amount: number
    transId: number | string
    description: string
  }) {
    const rawSignatureData = buildRefundSignatureData({
      accessKey: this.options_.accessKey,
      amount: input.amount,
      description: input.description,
      orderId: input.orderId,
      partnerCode: this.options_.partnerCode,
      requestId: input.requestId,
      transId: input.transId,
    })
    const body: MomoRefundRequest = {
      partnerCode: this.options_.partnerCode,
      orderId: input.orderId,
      requestId: input.requestId,
      amount: input.amount,
      transId: input.transId,
      lang: this.options_.lang ?? "vi",
      description: input.description,
      signature: signMomoPayload(rawSignatureData, this.options_.secretKey),
    }

    return {
      request: body,
      response: await this.post<MomoRefundResponse>(
        "/v2/gateway/api/refund",
        body
      ),
    }
  }

  private async post<TResponse>(path: string, body: Record<string, unknown>) {
    const endpoint = (this.options_.endpoint ?? DEFAULT_MOMO_ENDPOINT).replace(
      /\/$/,
      ""
    )
    const response = await fetch(`${endpoint}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(body),
    })

    const data = (await response.json().catch(() => ({}))) as TResponse

    if (!response.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `MoMo API ${path} failed with HTTP ${response.status}`
      )
    }

    return data
  }
}
