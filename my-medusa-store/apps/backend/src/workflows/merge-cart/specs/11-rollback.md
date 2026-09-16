# 11 — Rollback & Compensation

## Purpose

Define the transactional consistency and rollback behavior using the Medusa Workflows SDK (Saga Pattern).

---

## 1. Saga Pattern in Medusa Workflows

Medusa v2 workflows follow the **Saga Pattern**. Every step that performs a mutation defines a corresponding **compensation function**. If an error occurs at any point during execution, the workflow engine automatically halts and executes compensation functions in reverse order.

```text
Step 1: Acquire Lock      ───►  Compensation 1: Release Lock
Step 2: Mutate Cart Items ───►  Compensation 2: Revert Cart Items
Step 3: Validate Inventory ───►  [FAILS]
                                     │
           ◄── Execute Rollback ─────┘
1. Revert Cart Items (Compensation 2)
2. Release Lock (Compensation 1)
```

---

## 2. Compensation by Step

### 2.1 Lock Acquisition (`acquireLockStep`)
- **Forward Action**: Acquires a distributed lock on `cart.id`.
- **Compensation Action**: Automatically releases the lock via `releaseLockStep`. Ensures no cart is deadlocked if downstream steps fail.

### 2.2 Adding Items (`addToCartWorkflow.runAsStep`)
- **Forward Action**: Adds new line items or increments quantities on Cart A.
- **Compensation Action**:
  - Newly created line items are deleted.
  - Incremented quantities on existing line items are reverted to their previous values.
  - Cart totals, adjustments, and tax lines are recalculated to restore original values.

### 2.3 Cart Ownership Transfer (`transferCartCustomerWorkflow.runAsStep`)
- **Forward Action**: Assigns `customer_id` to Cart B.
- **Compensation Action**: Reverts `customer_id` back to `null` (restoring Cart B as a guest cart).

---

## 3. Guarantees Upon Failure

When the workflow fails at any step:
1. **Cart A Integrity**: Cart A returns to the exact state it had before the merge began.
2. **Cart B Integrity**: Cart B is never modified during the merge path and remains intact.
3. **Lock Freedom**: All locks on Cart A and Cart B are guaranteed to be released.
4. **Idempotency**: The customer or client can safely retry the merge request after addressing the failure cause (e.g., refreshing items).
