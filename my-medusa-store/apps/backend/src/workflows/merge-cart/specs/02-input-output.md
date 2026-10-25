# 02 — Input / Output

## Purpose

Define the input and output contract of the `mergeGuestCartIntoCustomerCartWorkflow` and its corresponding Store API endpoint `POST /store/carts/:id/merge-customer`.

---

## 1. Workflow Input Contract

```ts
export type MergeGuestCartInput = {
  customer_id: string
  guest_cart_id: string
  sales_channel_id: string
  additional_data?: Record<string, unknown>
}
```

### Field Descriptions

#### `customer_id` (Required)
- The ID of the authenticated customer (`req.auth_context?.actor_id`).
- Used to discover whether the customer already possesses an active uncompleted cart (Cart A).
- Receives ownership of the cart in the transfer path.

#### `guest_cart_id` (Required)
- The ID of the guest cart (Cart B) passed via URL param `:id`.
- The source cart to be transferred or merged and subsequently cleaned up.

#### `sales_channel_id` (Required)
- The Sales Channel ID extracted from `req.publishable_key_context.sales_channel_ids[0]`.
- On `/store` routes, the `x-publishable-api-key` header is **mandatory**, so this value is always available.
- Used to scope Cart Discovery to the current Sales Channel (ensuring per-channel cart isolation).
- Used to validate that the guest cart belongs to the same Sales Channel as the request (cross-channel merge is rejected with `SALES_CHANNEL_MISMATCH`).

#### `additional_data` (Optional)
- Optional metadata or extension attributes passed from the client body.

---

## 2. Workflow Output Contract

```ts
export type SkippedCartItem = {
  variant_id: string
  title: string
  variant_title?: string
  quantity: number
  reason: string
}

export type MergeGuestCartOutput = {
  cart_id: string
  skipped_items: SkippedCartItem[]
}
```

### Field Descriptions

#### `cart_id`
- The ID of the active cart resulting from the operation:
  - **Transfer Path**: `cart_id = guest_cart_id` (Cart B transferred to customer).
  - **Merge Path**: `cart_id = cartA.id` (Customer Cart A containing merged items).

#### `skipped_items`
- An array containing line items from Cart B that were excluded from the merge due to inventory or availability constraints:
  - In **Transfer Path**: Always empty `[]`.
  - In **Merge Path**: Contains items that could not be merged, along with machine-readable reasons:
    - `"OUT_OF_STOCK"`: Inventory is managed and variant has 0 stock.
    - `"EXCEEDS_AVAILABLE_STOCK"`: Variant has some stock, but Cart A existing quantity + Cart B guest quantity exceeds available inventory.
    - `"NO_INVENTORY_ITEMS"`: Variant has `manage_inventory = true` but has no inventory item levels linked.
    - `"VARIANT_NOT_FOUND"`: Variant ID does not exist.

---

## 3. Store API Endpoint Contract

* **Endpoint:** `POST /store/carts/:id/merge-customer`
* **Auth:** Required `Bearer <customer_token>`
* **Header:** Required `x-publishable-api-key: <publishable_key>` (standard for all `/store` routes)

### Request
- **URL Param `:id`**: `guest_cart_id`
- **Header**: `x-publishable-api-key` — determines `sales_channel_id`
- **Body**:
```json
{
  "additional_data": {}
}
```

### Response (`200 OK`)
```json
{
  "cart": {
    "id": "cart_01M2..."
  },
  "skipped_items": [
    {
      "variant_id": "variant_01...",
      "title": "Quần Tây Nam Slimfit",
      "variant_title": "Size L / Đen",
      "quantity": 1,
      "reason": "EXCEEDS_AVAILABLE_STOCK"
    }
  ]
}
```

### Error Response (`400 Bad Request` — Cross-Channel Mismatch)
```json
{
  "type": "invalid_data",
  "message": "SALES_CHANNEL_MISMATCH: Guest cart belongs to sales channel 'sc_A' but request targets 'sc_B'"
}
```