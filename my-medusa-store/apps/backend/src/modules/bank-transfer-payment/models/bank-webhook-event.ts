import { model } from "@medusajs/framework/utils"

const BankWebhookEvent = model.define("bank_webhook_event", {
  id: model.id({ prefix: "bwevt" }).primaryKey(),
  event_id: model.text().index().nullable(),
  external_transaction_id: model.text().index().nullable(),
  status: model
    .enum(["received", "processed", "ignored", "failed"])
    .default("received"),
  raw_payload: model.json<Record<string, unknown>>(),
  headers: model.json<Record<string, string>>().nullable(),
  error_message: model.text().nullable(),
  processed_at: model.dateTime().nullable(),
})

export default BankWebhookEvent
