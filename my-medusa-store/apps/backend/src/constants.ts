export const FIRST_PURCHASE_PROMOTION_CODE = "WELCOME10"
export const LOYALTY_PROMOTION_PREFIX = "LOYALTY"

export const LOYALTY_EARN_SPEND = 10_000
export const LOYALTY_REDEMPTION_POINTS = 100
export const LOYALTY_REDEMPTION_VALUE = 10_000

export const CUSTOMER_TIERS = {
  bronze: { name: "Bronze", minimumSpend: 0, discountPercentage: 0 },
  silver: { name: "Silver", minimumSpend: 2_000_000, discountPercentage: 5 },
  gold: { name: "Gold", minimumSpend: 10_000_000, discountPercentage: 10 },
} as const

export type CustomerTier = keyof typeof CUSTOMER_TIERS

export function getCustomerTier(totalSpend: number): CustomerTier {
  if (totalSpend >= CUSTOMER_TIERS.gold.minimumSpend) {
    return "gold"
  }

  if (totalSpend >= CUSTOMER_TIERS.silver.minimumSpend) {
    return "silver"
  }

  return "bronze"
}
