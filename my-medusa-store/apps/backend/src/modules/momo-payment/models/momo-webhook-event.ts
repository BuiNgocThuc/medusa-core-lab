import { model } from "@medusajs/framework/utils"

const MomoWebhookEvent = model.define("momo_webhook_event", {
  id: model.id({ prefix: "mowevt" }).primaryKey(),
  momo_payment_id: model.text().index().nullable(),
  event_key: model.text().unique(),
  order_id: model.text().index().nullable(),
  request_id: model.text().index().nullable(),
  trans_id: model.text().index().nullable(),
  result_code: model.number().nullable(),
  signature_valid: model.boolean().default(false),
  processing_status: model
    .enum(["received", "processed", "duplicate", "ignored", "failed"])
    .default("received"),
  raw_payload: model.json<Record<string, unknown>>(),
  error_message: model.text().nullable(),
  processed_at: model.dateTime().nullable(),
})

export default MomoWebhookEvent
