export type MergeGuestCartInput = {
  customer_id: string
  guest_cart_id: string
  sales_channel_id: string
  additional_data?: Record<string, unknown>
}

export type SkippedCartItem = {
  variant_id: string
  title: string
  variant_title?: string
  quantity: number
  reason: string
}

export type MergeGuestCartOutput = {
  cart: { id: string }
  skipped_items: SkippedCartItem[]
}

export default MergeGuestCartInput

