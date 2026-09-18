# 14 — Merge Path

## Purpose

Define the complete execution sequence when the authenticated customer already has an active cart (Cart A).

---

## 1. Preconditions

- Customer Cart A exists, is active, and is distinct from `guest_cart_id`.
- Guest Cart B exists and is active.
- Customer is authenticated.

---

## 2. Execution Sequence Diagram

```text
       Start Merge Path (Cart A exists)
                      │
                      ▼
        1. Acquire Dual Locks [Cart A, Cart B]
                      │
                      ▼
        2. Query Guest Cart (useQueryGraphStep)
                      │
                      ▼
        3. Validate Cumulative Inventory & Channel
        (validateInventoryForMergeStep)
                      │
           ┌──────────┴──────────┐
           │                     │
     valid_items > 0       valid_items == 0
           │                     │
           ▼                     │
 4. addToCartWorkflow            │
 (Cart A, valid_items)           │
           │                     │
           └──────────┬──────────┘
                      │
                      ▼
        5. Delete Guest Cart (deleteCartStep)
                      │
                      ▼
        6. Release Dual Locks [Cart A, Cart B]
                      │
                      ▼
        7. Return Merge Result
        { cart_id: cartA.id, skipped_items: [...] }
```

---

## 3. Step Execution Details

### Step 1: Acquire Dual Locks
Locks both carts to protect Cart A from concurrent writes and prevent Cart B from being accessed while merging/deleting:
```ts
acquireLockStep({
  key: [customerCartTransform.id, input.guest_cart_id!],
  timeout: 30,
  ttl: 120,
}).config({ name: "acquire-merge-locks" })
```

### Step 2: Query Guest Cart
Fetches line items, variant IDs, quantities, and metadata from Cart B via `useQueryGraphStep`.

### Step 3: Validate Inventory & Sales Channel
Executes custom step `validateInventoryForMergeStep`:
- Computes `existingQty (Cart A) + guestQty (Cart B)` for each variant.
- Verifies stock locations linked to Cart A's sales channel.
- Partitions items into `valid_items` and `skipped_items` with reason codes.

### Step 4: Add Eligible Items to Cart A
Calls Medusa Core's `addToCartWorkflow`:
```ts
addToCartWorkflow.runAsStep({
  input: {
    cart_id: customerCartTransform.id,
    items: inventoryValidationResult.valid_items,
  },
})
```
Medusa Core automatically manages price recalculation, item quantity accumulation, promotions, and tax recalculation on Cart A.

### Step 5: Clean Up Guest Cart
Removes Cart B from the database:
```ts
deleteCartStep({
  cart_id: input.guest_cart_id!,
}).config({ name: "delete-merged-guest-cart" })
```
If a failure occurs during execution, `deleteCartStep`'s compensation handler restores Cart B.

### Step 6: Release Distributed Locks
```ts
releaseLockStep({
  key: [customerCartTransform.id, input.guest_cart_id],
}).config({ name: "release-merge-locks" })
```

### Step 7: Format & Return Result
```ts
return new WorkflowResponse({
  cart_id: customerCartTransform.id,
  skipped_items: inventoryValidationResult.skipped_items,
})
```

---

## 4. Invariants

1. **Cart A is Primary**: Customer continues using Cart A as their sole active cart.
2. **Cart B is Cleaned Up**: Cart B is deleted from the active database to ensure multi-device consistency.
3. **Graceful Degradation**: Out-of-stock items in Cart B do not prevent in-stock items from merging.