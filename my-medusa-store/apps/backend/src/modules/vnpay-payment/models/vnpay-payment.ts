import { model } from "@medusajs/framework/utils"

const VnpayPayment = model.define("vnpay_payment", {
  id: model.id({ prefix: "vnppay" }).primaryKey(),
  payment_session_id: model.text().unique(),
  cart_id: model.text().index().nullable(),
  order_id: model.text().index().nullable(),
  provider_id: model.text().index(),
  vnp_txn_ref: model.text().unique(),
  amount: model.number(),
  currency_code: model.text(),
  status: model
    .enum([
      "initiated",
      "pending",
      "paid",
      "failed",
      "canceled",
      "expired",
      "refunded",
      "partially_refunded",
      "manual_review",
    ])
    .default("initiated"),
  response_code: model.text().nullable(),
  transaction_status: model.text().nullable(),
  message: model.text().nullable(),
  transaction_no: model.text().index().nullable(),
  bank_code: model.text().nullable(),
  bank_tran_no: model.text().nullable(),
  card_type: model.text().nullable(),
  pay_date: model.text().nullable(),
  payment_url: model.text().nullable(),
  raw_create_params: model.json<Record<string, unknown>>().nullable(),
  raw_gateway_payload: model.json<Record<string, unknown>>().nullable(),
  paid_at: model.dateTime().nullable(),
  expires_at: model.dateTime().nullable(),
  last_queried_at: model.dateTime().nullable(),
  query_count: model.number().default(0),
  metadata: model.json<Record<string, unknown>>().nullable(),
})

export default VnpayPayment
