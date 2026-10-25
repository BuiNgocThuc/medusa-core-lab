import { model } from "@medusajs/framework/utils"

const VnpayWebhookEvent = model.define("vnpay_webhook_event", {
  id: model.id({ prefix: "vnpwevt" }).primaryKey(),
  vnpay_payment_id: model.text().index().nullable(),
  event_key: model.text().unique(),
  txn_ref: model.text().index().nullable(),
  transaction_no: model.text().index().nullable(),
  response_code: model.text().nullable(),
  transaction_status: model.text().nullable(),
  signature_valid: model.boolean().default(false),
  processing_status: model
    .enum(["received", "processed", "duplicate", "ignored", "failed"])
    .default("received"),
  raw_payload: model.json<Record<string, unknown>>(),
  error_message: model.text().nullable(),
  processed_at: model.dateTime().nullable(),
})

export default VnpayWebhookEvent
