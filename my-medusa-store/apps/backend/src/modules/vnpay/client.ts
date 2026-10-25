/**
 * Client giao tiếp API VNPay Merchant WebAPI:
 * - Gửi yêu cầu refund qua API merchant_webapi/api/transaction.
 * - Xây dựng payload & chữ ký HMAC SHA512 cho giao dịch refund VNPay.
 */
import { MedusaError } from "@medusajs/framework/utils"

import {
  buildVnpayRefundSignatureData,
  formatVnpayDate,
  signVnpayPayload,
} from "./crypto"
import type {
  VnpayProviderOptions,
  VnpayRefundRequest,
  VnpayRefundResponse,
} from "./types"

const DEFAULT_TRANSACTION_API_URL =
  "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction"

export class VnpayClient {
  private readonly options_: VnpayProviderOptions

  constructor(options: VnpayProviderOptions) {
    this.options_ = {
      transactionApiUrl: DEFAULT_TRANSACTION_API_URL,
      version: "2.1.0",
      refundCreateBy: "system",
      refundIpAddress: "127.0.0.1",
      ...options,
    }
  }

  async refund(input: {
    requestId: string
    txnRef: string
    amount: number
    transactionNo: string
    transactionDate: string
    transactionType: "02" | "03"
    orderInfo: string
  }) {
    const createDate = formatVnpayDate(new Date())
    const version = this.options_.version ?? "2.1.0"
    const command = "refund"
    const createBy = this.options_.refundCreateBy ?? "system"
    const ipAddress = this.options_.refundIpAddress ?? "127.0.0.1"
    const rawSignatureData = buildVnpayRefundSignatureData({
      requestId: input.requestId,
      version,
      command,
      tmnCode: this.options_.tmnCode,
      transactionType: input.transactionType,
      txnRef: input.txnRef,
      // eslint-disable-next-line @medusajs/prices-in-major-units
      amount: input.amount * 100,
      transactionNo: input.transactionNo,
      transactionDate: input.transactionDate,
      createBy,
      createDate,
      ipAddress,
      orderInfo: input.orderInfo,
    })
    const body: VnpayRefundRequest = {
      vnp_RequestId: input.requestId,
      vnp_Version: version,
      vnp_Command: command,
      vnp_TmnCode: this.options_.tmnCode,
      vnp_TransactionType: input.transactionType,
      vnp_TxnRef: input.txnRef,
      vnp_Amount: input.amount * 100,
      vnp_OrderInfo: input.orderInfo,
      vnp_TransactionNo: input.transactionNo,
      vnp_TransactionDate: input.transactionDate,
      vnp_CreateBy: createBy,
      vnp_CreateDate: createDate,
      vnp_IpAddr: ipAddress,
      vnp_SecureHash: signVnpayPayload(
        rawSignatureData,
        this.options_.hashSecret
      ),
    }

    return {
      request: body,
      response: await this.post<VnpayRefundResponse>(body),
    }
  }

  private async post<TResponse>(body: Record<string, unknown>) {
    const endpoint = (
      this.options_.transactionApiUrl ?? DEFAULT_TRANSACTION_API_URL
    ).replace(/\/$/, "")
    const response = await fetch(endpoint, {
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
        `VNPay transaction API failed with HTTP ${response.status}`
      )
    }

    return data
  }
}
