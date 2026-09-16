export type MergeGuestCartInput = {
  customer_id: string
  guest_cart_id: string
  additional_data?: Record<string, unknown>
}

// export type SkippedCartItem = {
//   variant_id: string
//   quantity: number
//   reason: string
// }

export type MergeGuestCartOutput = {
  cart_id: string
  // merged: boolean
  // skipped_items: SkippedCartItem[]
}

export default MergeGuestCartInput
