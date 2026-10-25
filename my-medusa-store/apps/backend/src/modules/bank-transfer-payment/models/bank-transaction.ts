import { model } from "@medusajs/framework/utils"

const BankTransaction = model.define("bank_transaction", {
  id: model.id({ prefix: "btxn" }).primaryKey(),
  external_transaction_id: model.text().unique(),
  payment_reference: model.text().index().nullable(),
  payment_session_id: model.text().index().nullable(),
  amount: model.number(),
  currency_code: model.text(),
  description: model.text().nullable(),
  status: model
    .enum([
      "matched",
      "duplicate",
      "underpaid",
      "overpaid",
      "unmatched",
      "expired",
      "failed",
      "ignored",
    ])
    .default("unmatched"),
  raw_payload: model.json<Record<string, unknown>>().nullable(),
  received_at: model.dateTime(),
  processed_at: model.dateTime().nullable(),
})

export default BankTransaction
