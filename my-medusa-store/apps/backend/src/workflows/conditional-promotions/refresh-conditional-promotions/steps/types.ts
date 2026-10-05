export type ConditionalPromotionCandidate = {
  code: string
  amount: number
  priority: number
  flash?: boolean
  custom?: boolean
  promoId?: string
  configId?: string
  flashSale?: {
    schedule: any
    sourcePromotion: any
    campaign: any
    usageLimit: number
  }
}
