import { model } from "@medusajs/framework/utils"

const MomoPayment = model.define("momo_payment", {
  id: model.id({ prefix: "mopay" }).primaryKey(),
  payment_session_id: model.text().unique(),
  cart_id: model.text().index().nullable(),
  order_id: model.text().index().nullable(),
  provider_id: model.text().index(),
  momo_order_id: model.text().unique(),
  request_id: model.text().unique(),
  amount: model.number(),
  currency_code: model.text(),
  status: model
    .enum([
      "initiated",
      "pending",
      "authorized",
      "paid",
      "failed",
      "canceled",
      "expired",
      "refunded",
      "partially_refunded",
      "manual_review",
    ])
    .default("initiated"),
  result_code: model.number().nullable(),
  message: model.text().nullable(),
  trans_id: model.text().index().nullable(),
  pay_type: model.text().nullable(),
  payment_option: model.text().nullable(),
  order_type: model.text().nullable(),
  user_fee: model.number().nullable(),
  pay_url: model.text().nullable(),
  short_link: model.text().nullable(),
  deeplink: model.text().nullable(),
  qr_code_url: model.text().nullable(),
  deeplink_mini_app: model.text().nullable(),
  raw_create_request: model.json<Record<string, unknown>>().nullable(),
  raw_create_response: model.json<Record<string, unknown>>().nullable(),
  paid_at: model.dateTime().nullable(),
  expires_at: model.dateTime().nullable(),
  last_queried_at: model.dateTime().nullable(),
  query_count: model.number().default(0),
  metadata: model.json<Record<string, unknown>>().nullable(),
})

export default MomoPayment
