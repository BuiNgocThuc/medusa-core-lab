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
  /**
   * Nếu partial merge: Số lượng thực sự được thêm vào Cart A (< quantity gốc).
   * Nếu undefined: Item bị skip hoàn toàn (0 được thêm).
   *
   * Ví dụ: Guest muốn thêm 3, nhưng kho chỉ cho phép thêm 1 → adjusted_quantity = 1
   * Frontend có thể hiện: "Áo thun đen M: Bạn muốn thêm 3, chỉ thêm được 1"
   */
  adjusted_quantity?: number
}

export type MergeGuestCartOutput = {
  cart: { id: string }
  skipped_items: SkippedCartItem[]
}

export default MergeGuestCartInput

