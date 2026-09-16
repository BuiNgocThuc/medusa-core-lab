export type MergeGuestCartInput = {
  guest_cart_id: string
  customer_id: string
  additional_data?: Record<string, unknown>
}

export default MergeGuestCartInput
