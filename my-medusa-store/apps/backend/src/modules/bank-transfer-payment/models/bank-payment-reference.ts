import { model } from "@medusajs/framework/utils"

const BankPaymentReference = model.define("bank_payment_reference", {
  id: model.id({ prefix: "bpr" }).primaryKey(),
  payment_reference: model.text().unique(),
  payment_session_id: model.text().unique(),
  provider_id: model.text().index(),
  expected_amount: model.number(),
  currency_code: model.text(),
  status: model
    .enum([
      "pending",
      "matched",
      "underpaid",
      "overpaid",
      "expired",
      "canceled",
      "manual_review",
    ])
    .default("pending"),
  expires_at: model.dateTime(),
  matched_transaction_id: model.text().index().nullable(),
  received_amount: model.number().nullable(),
  matched_at: model.dateTime().nullable(),
  metadata: model.json<Record<string, unknown>>().nullable(),
})

export default BankPaymentReference
