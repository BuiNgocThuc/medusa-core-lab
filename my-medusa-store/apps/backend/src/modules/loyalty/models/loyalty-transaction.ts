import { model } from "@medusajs/framework/utils"

const LoyaltyTransaction = model.define("loyalty_transaction", {
  id: model.id().primaryKey(),
  customer_id: model.text(),
  type: model.enum(["earn", "redeem"]),
  points: model.number(),
  order_id: model.text().nullable(),
  cart_id: model.text().nullable(),
  promotion_id: model.text().nullable(),
})

export default LoyaltyTransaction
