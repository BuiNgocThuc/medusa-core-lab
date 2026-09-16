# 02 — Input / Output

## Purpose

Define the input contract and output contract of the `mergeGuestCartIntoCustomerCartWorkflow`.

The workflow handles the complete cart synchronization lifecycle upon customer login:
1. **Merge Path**: Guest cart items are merged into existing customer cart.
2. **Transfer Path**: Guest cart is transferred to customer when no customer cart exists.
3. **Restore Path**: Existing customer cart is restored when user logs in with no guest cart.

---

## Input Contract

```ts
export type MergeGuestCartIntoCustomerCartWorkflowInput = {
  customer_id: string
  guest_cart_id?: string
  additional_data?: Record<string, unknown>
}
```

### `customer_id` (Required)
The ID of the authenticated customer who will own the destination cart.

- **Requirements**:
  - Must be provided and represent an authenticated customer.
- **Usage**:
  - Discover the customer's existing active cart (Cart A).
  - Transfer Cart B ownership when Cart A does not exist.
  - Verify customer ownership of Cart A.

### `guest_cart_id` (Optional)
The ID of the guest cart (Cart B).

- **Scenarios**:
  - **Present (`guest_cart_id !== undefined`)**: The customer added items to a guest cart before logging in $\rightarrow$ Merge or Transfer path.
  - **Missing (`guest_cart_id === undefined`)**: The customer logged in without adding any items to a guest cart $\rightarrow$ Restore path.

### `additional_data` (Optional)
Optional contextual data passed through to underlying Medusa workflows.

---

## Output Contract

```ts
export type SkippedCartItem = {
  variant_id: string
  quantity: number
  reason: string
}

export type MergeGuestCartIntoCustomerCartResult = {
  cart_id: string | null
  merged: boolean
  skipped_items: SkippedCartItem[]
}
```

### Output Fields

#### `cart_id`
The ID of the active customer cart, or `null` if no cart exists:
- **Merge Path**: `cart_id = cartA.id` (Customer Cart A).
- **Transfer Path**: `cart_id = guest_cart_id` (Guest Cart B transferred to customer).
- **Restore Path (Cart A exists)**: `cart_id = cartA.id` (Restored customer cart).
- **Restore Path (No cart anywhere)**: `cart_id = null` (No cart created yet; lazy creation on first item added).

#### `merged`
- `true`: Items were merged into an existing Cart A.
- `false`: Cart B was transferred or Cart A was restored without a merge operation.

#### `skipped_items`
Array of items from Cart B that were intentionally not merged.

---

## Output Behavior by Execution Path

### Path 1: Restore Path (No Guest Cart)
- **Input**: `customer_id: "cus_123"`, `guest_cart_id: undefined`.
- **Behavior**:
  - If Customer Cart A exists $\rightarrow$ `{ cart_id: cartA.id, merged: false, skipped_items: [] }`.
  - If Customer Cart A does not exist $\rightarrow$ `{ cart_id: null, merged: false, skipped_items: [] }`.

### Path 2: Transfer Path (Guest Cart exists, No Customer Cart)
- **Input**: `customer_id: "cus_123"`, `guest_cart_id: "cart_b"`, Customer has no Cart A.
- **Behavior**: Cart B transferred to customer $\rightarrow$ `{ cart_id: "cart_b", merged: false, skipped_items: [] }`.

### Path 3: Merge Path (Both Guest Cart and Customer Cart exist)
- **Input**: `customer_id: "cus_123"`, `guest_cart_id: "cart_b"`, Customer has Cart A.
- **Behavior**: Cart B items merged into Cart A $\rightarrow$ `{ cart_id: cartA.id, merged: true, skipped_items: [...] }`.