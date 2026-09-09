import { model } from "@medusajs/framework/utils"

const LoyaltyAccount = model.define("loyalty_account", {
  id: model.id().primaryKey(),
  customer_id: model.text().unique(),
  balance: model.number().default(0),
})

export default LoyaltyAccount
