import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows"

import {
  BANK_TRANSFER_PAYMENT_MODULE,
} from "../../../../modules/bank-transfer-payment"
import BankTransferPaymentModuleService from "../../../../modules/bank-transfer-payment/service"

type BankTransferWebhookRequest = {
  event_id?: string
  transaction_id?: string
  amount?: number | string
  currency_code?: string
  description?: string
  payment_reference?: string
}

export async function POST(
  req: MedusaRequest<BankTransferWebhookRequest>,
  res: MedusaResponse
) {
  assertValidWebhookSecret(req)

  const body = req.body ?? {}
  const transactionId = body.transaction_id?.trim()
  const amount = toNumber(body.amount)
  const currencyCode = body.currency_code?.toLowerCase()

  if (!transactionId || !amount || !currencyCode) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "transaction_id, amount, and currency_code are required"
    )
  }

  const bankTransferPaymentService =
    req.scope.resolve<BankTransferPaymentModuleService>(
      BANK_TRANSFER_PAYMENT_MODULE
    )

  const match = await bankTransferPaymentService.matchIncomingTransfer({
    event_id: body.event_id,
    transaction_id: transactionId,
    amount,
    currency_code: currencyCode,
    description: body.description,
    payment_reference: body.payment_reference,
    raw_payload: body as Record<string, unknown>,
    headers: stringifyHeaders(req.headers),
  })

  if (match.process_payment && match.payment_session_id && match.amount) {
    await processPaymentWorkflow(req.scope).run({
      input: {
        action: "authorized",
        data: {
          session_id: match.payment_session_id,
          amount: match.amount,
        },
      },
    })

    await processPaymentWorkflow(req.scope).run({
      input: {
        action: "captured",
        data: {
          session_id: match.payment_session_id,
          amount: match.amount,
        },
      },
    })
  }

  res.status(200).json({
    status: match.status,
    process_payment: match.process_payment,
    payment_session_id: match.payment_session_id,
    payment_reference: match.payment_reference,
    reason: match.reason,
  })
}

function assertValidWebhookSecret(req: MedusaRequest) {
  const expected = process.env.BANK_TRANSFER_WEBHOOK_SECRET

  if (!expected) {
    return
  }

  const received = readHeader(req.headers, "x-bank-signature")

  if (received !== expected) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Invalid bank transfer webhook signature"
    )
  }
}

function readHeader(
  headers: MedusaRequest["headers"],
  key: string
): string | undefined {
  const value = headers[key] ?? headers[key.toLowerCase()]

  if (Array.isArray(value)) {
    return value[0]
  }

  return typeof value === "string" ? value : undefined
}

function stringifyHeaders(headers: MedusaRequest["headers"]) {
  return Object.entries(headers).reduce<Record<string, string>>(
    (result, [key, value]) => {
      result[key] = Array.isArray(value)
        ? value.join(",")
        : value?.toString() ?? ""

      return result
    },
    {}
  )
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value
  }

  if (typeof value === "string") {
    return Number(value)
  }

  return 0
}
