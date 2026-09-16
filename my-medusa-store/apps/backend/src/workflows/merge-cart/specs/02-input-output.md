# 02 — Input / Output

## Purpose

Define the input contract and output contract of the `mergeGuestCartIntoCustomerCartWorkflow`.

The workflow is responsible for merging a guest cart into the authenticated customer's existing cart, or transferring the guest cart to the customer when no existing customer cart is found.

---

## Input Contract

```ts
export type MergeGuestCartIntoCustomerCartWorkflowInput = {
  guest_cart_id: string
  customer_id: string
  additional_data?: Record<string, unknown>
}
```

### `guest_cart_id`
The ID of the guest cart (referred to as **Cart B**). Cart B is the source cart in the merge path.

- **Requirements**:
  - Must be provided and non-empty.
  - Cart B must exist in the database.
  - Cart B must be usable (not completed or deleted).
- **Usage**:
  - Retrieve Cart B and its line items.
  - Validate source items against destination sales channel.
  - Transfer ownership to customer when Cart A does not exist.
  - Extract line items to merge into Cart A when Cart A exists.

### `customer_id`
The ID of the authenticated customer who will own the destination cart.

- **Requirements**:
  - Must be provided and represent an authenticated customer.
- **Usage**:
  - Discover the customer's existing active cart (Cart A).
  - Transfer Cart B ownership when Cart A does not exist.
  - Verify customer ownership of Cart A when Cart A exists.

### `additional_data`
Optional contextual data passed through to underlying Medusa workflows if needed.

- **Constraints**:
  - Must not be used to bypass business rules.
  - Must not override Cart A's region, currency, or sales channel.
  - Must not bypass inventory or pricing validation.

---

## Output Contract

```ts
export type SkippedCartItem = {
  variant_id: string
  quantity: number
  reason: string
}

export type MergeGuestCartIntoCustomerCartResult = {
  cart_id: string
  merged: boolean
  skipped_items: SkippedCartItem[]
}
```

### Output Fields

#### `cart_id`
The ID of the final customer cart.
- **Transfer Path** (Cart A does not exist): `cart_id = guest_cart_id` (Cart B became the customer's cart).
- **Merge Path** (Cart A exists): `cart_id = cartA.id` (Cart A is the canonical destination cart).

#### `merged`
Boolean flag indicating whether a line-item merge into an existing cart occurred:
- `false`: Transfer path executed (no items merged into a separate cart).
- `true`: Merge path executed (eligible items merged into Cart A).

#### `skipped_items`
Array of items from Cart B that were intentionally not merged (e.g., variant unavailable in Cart A's sales channel).
```json
{
  "variant_id": "variant_123",
  "quantity": 2,
  "reason": "Variant is not available in the customer's sales channel"
}
```

---

## Output Behavior by Execution Path

### Path 1: Transfer Path (No Existing Customer Cart)
- **Condition**: Cart A does not exist.
- **Action**: Cart B ownership is transferred to `customer_id`.
- **Response**:
```json
{
  "cart_id": "guest_cart_id",
  "merged": false,
  "skipped_items": []
}
```

### Path 2: Merge Path (Existing Customer Cart)
- **Condition**: Cart A exists and is active.
- **Action**: Eligible Cart B line items are merged into Cart A.
- **Response**:
```json
{
  "cart_id": "cart_a_id",
  "merged": true,
  "skipped_items": [
    {
      "variant_id": "variant_unavailable",
      "quantity": 1,
      "reason": "Variant is not available in the customer's sales channel"
    }
  ]
}
```

---

## Failure Behavior

The workflow fails atomically (throws an error) without returning a successful result in any of the following cases:
1. `guest_cart_id` does not exist or represents a completed cart.
2. Cart A exists but fails validation (e.g., belongs to another customer or is completed).
3. All items in Cart B are unavailable in Cart A's sales channel (`validItems.length === 0`).
4. Inventory validation fails for any merged item.
5. Core cart mutation (`addToCartWorkflow` or `transferCartCustomerWorkflow`) fails.

---

## Non-Responsibilities

1. **Cart Totals**: The workflow result does not return recalculated financial fields (`subtotal`, `total`, `tax_total`, `discount_total`). These are handled by Medusa core on Cart A.
2. **Cart B Persistence**: Cart B is not returned in the result and in Phase 1 is not deleted.