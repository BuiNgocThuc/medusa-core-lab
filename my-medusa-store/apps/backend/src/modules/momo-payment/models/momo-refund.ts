import { model } from "@medusajs/framework/utils"

const MomoRefund = model.define("momo_refund", {
  id: model.id({ prefix: "moref" }).primaryKey(),
  momo_payment_id: model.text().index(),
  payment_id: model.text().index().nullable(),
  refund_order_id: model.text().unique(),
  request_id: model.text().unique(),
  amount: model.number(),
  status: model
    .enum(["pending", "succeeded", "failed", "manual_review"])
    .default("pending"),
  result_code: model.number().nullable(),
  message: model.text().nullable(),
  refund_trans_id: model.text().index().nullable(),
  raw_request: model.json<Record<string, unknown>>().nullable(),
  raw_response: model.json<Record<string, unknown>>().nullable(),
  processed_at: model.dateTime().nullable(),
})

export default MomoRefund
