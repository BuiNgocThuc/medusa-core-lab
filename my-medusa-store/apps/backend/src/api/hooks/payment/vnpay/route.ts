/**
 * Custom Backend Hook nhận callback từ VNPay:
 * - Verify checksum & signature từ VNPay.
 * - Ghi nhận webhook event, cập nhật status vnpay_payment.
 * - Gọi processPaymentWorkflow (authorize & capture).
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows"

import {
  verifyVnpaySignature,
  withoutVnpayHashParams,
} from "../../../../modules/vnpay/crypto"
import type { VnpayGatewayPayload } from "../../../../modules/vnpay/types"
import { VNPAY_PAYMENT_MODULE } from "../../../../modules/vnpay-payment"
import VnpayPaymentModuleService from "../../../../modules/vnpay-payment/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const body = normalizeQuery(req.query ?? {})
  const tmnCode = process.env.VNPAY_TMN_CODE
  const hashSecret = process.env.VNPAY_HASH_SECRET

  if (!tmnCode || !hashSecret) {
    res.status(500).json({
      RspCode: "99",
      Message: "VNPay is not configured",
    })
    return
  }

  if (!body.vnp_TxnRef || !body.vnp_TmnCode || !body.vnp_SecureHash) {
    res.status(400).json({
      RspCode: "99",
      Message: "Missing required VNPay fields",
    })
    return
  }

  if (body.vnp_TmnCode !== tmnCode) {
    res.status(400).json({
      RspCode: "97",
      Message: "Invalid checksum",
    })
    return
  }

  const signatureValid = verifyVnpaySignature(body, hashSecret)
  const vnpayPaymentService = req.scope.resolve<VnpayPaymentModuleService>(
    VNPAY_PAYMENT_MODULE
  )
  const eventKey = [
    body.vnp_TmnCode,
    body.vnp_TxnRef,
    body.vnp_TransactionNo ?? "",
    body.vnp_ResponseCode ?? "",
    body.vnp_TransactionStatus ?? "",
    body.vnp_PayDate ?? "",
  ].join(":")

  const result = await vnpayPaymentService.completePaymentFromGateway({
    vnp_txn_ref: body.vnp_TxnRef,
    amount: fromVnpayAmount(body.vnp_Amount),
    response_code: body.vnp_ResponseCode,
    transaction_status: body.vnp_TransactionStatus,
    message: body.vnp_ResponseCode,
    transaction_no: body.vnp_TransactionNo,
    bank_code: body.vnp_BankCode,
    bank_tran_no: body.vnp_BankTranNo,
    card_type: body.vnp_CardType,
    pay_date: body.vnp_PayDate,
    raw_payload: {
      ...withoutVnpayHashParams(body),
      vnp_SecureHash: "[masked]",
    },
    signature_valid: signatureValid,
    event_key: eventKey,
  })

  if (!signatureValid) {
    res.status(200).json({
      RspCode: "97",
      Message: "Invalid checksum",
    })
    return
  }

  if (result.status === "not_found") {
    res.status(200).json({
      RspCode: "01",
      Message: "Order not found",
    })
    return
  }

  if (result.reason === "VNPay amount mismatch") {
    res.status(200).json({
      RspCode: "04",
      Message: "Invalid amount",
    })
    return
  }

  if (result.status === "duplicate") {
    res.status(200).json({
      RspCode: "02",
      Message: "Order already confirmed",
    })
    return
  }

  if (result.process_payment && result.payment_session_id && result.amount) {
    try {
      await processPaymentWorkflow(req.scope).run({
        input: {
          action: "authorized",
          data: {
            session_id: result.payment_session_id,
            amount: result.amount,
          },
        },
      })

      await processPaymentWorkflow(req.scope).run({
        input: {
          action: "captured",
          data: {
            session_id: result.payment_session_id,
            amount: result.amount,
          },
        },
      })
    } catch (error) {
      logger.error(
        `[vnpay] Failed to process payment ${body.vnp_TxnRef}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      res.status(200).json({
        RspCode: "99",
        Message: "Payment processing failed",
      })
      return
    }
  }

  res.status(200).json({
    RspCode: "00",
    Message: "Confirm Success",
  })
}

function normalizeQuery(query: Record<string, unknown>): VnpayGatewayPayload {
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [
      key,
      Array.isArray(value) ? String(value[0]) : String(value),
    ])
  ) as VnpayGatewayPayload
}

function fromVnpayAmount(amount?: string) {
  const parsed = Number(amount)

  return Number.isFinite(parsed) ? parsed / 100 : 0
}
