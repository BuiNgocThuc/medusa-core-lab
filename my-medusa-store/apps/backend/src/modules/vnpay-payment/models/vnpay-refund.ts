import { model } from "@medusajs/framework/utils"

const VnpayRefund = model.define("vnpay_refund", {
  id: model.id({ prefix: "vnpref" }).primaryKey(),
  vnpay_payment_id: model.text().index(),
  payment_id: model.text().index().nullable(),
  request_id: model.text().unique(),
  txn_ref: model.text().index(),
  amount: model.number(),
  transaction_type: model.text(),
  status: model
    .enum(["pending", "processing", "succeeded", "failed", "manual_review"])
    .default("pending"),
  response_code: model.text().nullable(),
  transaction_status: model.text().nullable(),
  message: model.text().nullable(),
  refund_transaction_no: model.text().index().nullable(),
  raw_request: model.json<Record<string, unknown>>().nullable(),
  raw_response: model.json<Record<string, unknown>>().nullable(),
  processed_at: model.dateTime().nullable(),
})

export default VnpayRefund
