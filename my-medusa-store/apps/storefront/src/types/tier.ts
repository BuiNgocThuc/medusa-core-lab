export type Tier = {
  id: string
  name: string
  promotion_id: string
}

export type CustomerNextTier = {
  current_tier: Tier | null
  current_purchase_value: number
  currency_code: string
  next_tier_upgrade: {
    tier: Tier | null
    required_amount: number
    current_purchase_value: number
    next_tier_min_purchase: number
  } | null
}
