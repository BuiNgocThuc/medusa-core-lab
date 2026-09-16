# 14 — Merge Path

## Purpose

Define the complete execution sequence when the authenticated customer already has an active cart (Cart A).

---

## 1. Preconditions

- Cart A exists and belongs to `customer_id`.
- Cart B exists and is uncompleted.
- Both carts passed initial validation (see [04-cart-validation.md](./04-cart-validation.md)).

---

## 2. Merge Path Flow

```text
       Start Merge Path (Cart A exists)
                     │
                     ▼
        1. Acquire Lock on Cart A
                     │
                     ▼
      2. Validate Sales Channel Items
      (Check Cart B items against Cart A sales channel)
                     │
          ┌──────────┴──────────┐
          │                     │
    validItems > 0        validItems == 0
          │                     │
          ▼                     ▼
3. Call addToCartWorkflow   Throw INVALID_DATA error
(items: validItems)             │
          │                     ▼
          ▼                Rollback & Unlock
  4. Release Lock on Cart A
          │
          ▼
  5. Return Merge Result
  { cart_id: cartA.id, merged: true, skipped_items: [...] }
```

---

## 3. Detailed Step Execution

### Step 1: Acquire Distributed Lock on Cart A
```ts
acquireLockStep({
  key: customerCart.id,
  timeout: 30,
  ttl: 120,
})
```

### Step 2: Validate & Filter Eligible Items
- Query variants from Cart B.
- Filter variants published in `customerCart.sales_channel_id`.
- If `validItems.length === 0`, throw `MedusaError(INVALID_DATA, "No items available in sales channel")`.

### Step 3: Execute `addToCartWorkflow`
Add eligible items to Cart A as a nested workflow step:
```ts
addToCartWorkflow.runAsStep({
  input: {
    cart_id: customerCart.id,
    items: validItems.map((item) => ({
      variant_id: item.variant_id,
      quantity: item.quantity,
      metadata: item.metadata,
    })),
  },
})
```
*Note: `addToCartWorkflow` automatically manages pricing recalculation, inventory confirmation, quantity accumulation for duplicate items, and cart totals.*

### Step 4: Release Distributed Lock
```ts
releaseLockStep({
  key: customerCart.id,
})
```

### Step 5: Format & Return Result
```ts
return new WorkflowResponse({
  cart_id: customerCart.id,
  merged: true,
  skipped_items: skippedItems,
})
```

---

## 4. Invariants

1. **Cart A is Canonical**: The final returned cart is always Cart A.
2. **Cart B is Read-Only**: Cart B line items are not deleted or mutated in this phase.