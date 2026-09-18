# 04 — Cart Validation

## Purpose

Validate Cart A and Cart B before entering the mutation phase, ensuring that both carts and their context are valid.

---

## 1. Cart B (Guest Cart) Validation

### 1.1 Cart B Must Exist
If Cart B cannot be found with `guest_cart_id`:
- Throws `MedusaError(MedusaError.Types.NOT_FOUND, "Guest cart not found")`.
- Workflow execution halts before any lock is acquired or mutation performed.

### 1.2 Cart B Must Be Usable
- `completed_at === null`: Cart B must be active. If checkout was already completed, it cannot be merged or transferred.

### 1.3 Cart B Items
- If Cart B contains 0 items:
  - In Transfer Path: Transferred as an empty cart to customer.
  - In Merge Path: `validateInventoryForMergeStep` returns empty `valid_items`, `addToCartWorkflow` is skipped, and Cart B is cleanly removed.

---

## 2. Cart A (Customer Cart) Validation

*(Applies when Cart A exists in DB)*

### 2.1 Customer Ownership
- Cart A must belong to `input.customer_id`.
- Handled during discovery by filtering `customer_id: input.customer_id`.

### 2.2 Usable State
- `completed_at === null`: Cart A must be active.
- Completed orders are filtered out of discovery.

---

## 3. Cart Context Authoritativeness

When Cart A exists, its context is **authoritative** and immutable during the merge:
```text
Cart A (Authoritative Context)
├── region_id
├── currency_code
├── sales_channel_id
└── customer_id
```

### Invariants:
1. **Region & Currency**: Cart A's region and currency are preserved. Line items added from Cart B are priced according to Cart A's region/currency context by Medusa core.
2. **Sales Channel**: Cart A's sales channel governs inventory availability for all incoming items from Cart B.
3. **Addresses**: Shipping and billing addresses of Cart A remain intact.