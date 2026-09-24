import { model } from "@medusajs/framework/utils";

export const LoyaltyTier = {
  BRONZE: "BRONZE",
  SILVER: "SILVER",
  GOLD: "GOLD",
} as const;

export const LoyaltyAccount = model.define("loyalty_account", {
  id: model.id().primaryKey(),
  customer_id: model.text().unique(),
  points: model.number().default(0),
  tier: model.enum(Object.values(LoyaltyTier)).default(LoyaltyTier.BRONZE),
});
