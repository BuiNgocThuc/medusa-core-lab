export type ConditionalPromotionCandidate = {
  code: string
  amount: number
  priority: number
  flash?: boolean
  custom?: boolean
  promoId?: string
  configId?: string
}
