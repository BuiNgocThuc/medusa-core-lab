# 04 — Cart Validation

## Purpose

Validate Cart A and Cart B before entering the mutation phase.

This phase ensures that both carts and their required context are valid for the selected execution path. Cart validation is **read-only**; no cart mutation should occur during this phase.

---

## Validation Scope

### What this phase validates:
- Cart B existence and usability.
- Cart A existence, customer ownership, and usability (when Cart A exists).
- Completeness of required context (region, currency, sales channel).

### What this phase does NOT validate:
- Sales channel availability of individual variants (handled in [05-sales-channel.md](./05-sales-channel.md)).
- Pricing recalculations (handled in [06-pricing.md](./06-pricing.md)).
- Inventory levels (handled in [08-inventory.md](./08-inventory.md)).
- Promotion re-evaluation (handled in [09-promotion.md](./09-promotion.md)).

---

## 1. Cart B (Guest Cart) Validation

### 1.1 Cart B Must Exist
If Cart B cannot be found with `guest_cart_id`:
```text
guest_cart_id -> no cart found
```
- **Action**: Throw `MedusaError(MedusaError.Types.NOT_FOUND, "Guest cart not found")`.
- **State**: Abort workflow immediately.

### 1.2 Cart B Must Be Usable
Cart B must not be in an invalid state:
- `completed_at !== null`: Cart B has already completed checkout $\rightarrow$ Throw `MedusaError(MedusaError.Types.NOT_ALLOWED, "Guest cart has already been completed")`.

### 1.3 Cart B Line Items
- If Cart B contains 0 line items:
  - In the transfer path: Cart B can still be transferred as an empty cart.
  - In the merge path: If Cart B has no items, the merge operation trivially completes without adding items to Cart A.

---

## 2. Cart A (Customer Cart) Validation

*Note: Applies only when Cart A exists.*

### 2.1 Customer Ownership
Cart A must belong to the authenticated customer:
```ts
if (customerCart.customer_id !== input.customer_id) {
  throw new MedusaError(
    MedusaError.Types.NOT_ALLOWED,
    "Customer cart does not belong to the authenticated customer"
  )
}
```

### 2.2 Usable State
- `completed_at === null`: Cart A must be uncompleted.
- If Cart A is completed, it should have been excluded during Discovery. If somehow present, throw an error.

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
1. **Region**: Cart A's region is preserved. Cart B's region is ignored.
2. **Currency**: Cart A's currency is preserved. Cart B's currency is ignored.
3. **Sales Channel**: Cart A's sales channel is preserved. Cart B items must conform to Cart A's sales channel.
4. **Addresses**: Shipping and billing addresses of Cart A remain authoritative.

---

## 4. Path Decision

After validation succeeds, the workflow branches into exactly one path:

```text
                    ┌──────────────────┐
                    │ Cart Validation  │
                    └────────┬─────────┘
                             │
                    Is Cart A available?
                       /             \
                     No               Yes
                     /                 \
                    v                   v
             Transfer Path          Merge Path
         (13-transfer-path.md)  (05-sales-channel.md)
```

---

## 5. Prohibited Operations During Validation
The validation phase must NOT:
- Add, update, or delete line items.
- Change customer ownership.
- Modify region, currency, or sales channel.
- Recalculate cart totals or reserve inventory.