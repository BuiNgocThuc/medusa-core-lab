# 11 — Rollback & Compensation

## Purpose

Define the transactional consistency and rollback behavior using the Medusa Workflows SDK (Saga Pattern).

---

## 1. Saga Pattern Execution

Medusa v2 workflows follow the **Saga Pattern**. Every step that modifies database state defines a compensation function. If an error occurs, the workflow engine automatically halts and executes compensations in reverse order.

---

## 2. Compensation Actions by Step

### 2.1 Distributed Lock (`acquireLockStep`)
- **Forward Action**: Acquires distributed locks on cart IDs.
- **Compensation**: Automatically releases all held locks, preventing deadlocks.

### 2.2 Adding Items (`addToCartWorkflow.runAsStep`)
- **Forward Action**: Inserts line items or increments quantities on Cart A.
- **Compensation**: Automatically removes inserted items and reverts line item quantities to their pre-merge state.

### 2.3 Guest Cart Deletion (`deleteCartStep`)
- **Forward Action**: Deletes Cart B using `cartService.deleteCarts([input.cart_id])`.
- **Compensation Action**:
  ```ts
  async (cartId, { container }) => {
    if (cartId) {
      const cartService = container.resolve<any>(Modules.CART)
      if (typeof cartService.restoreCarts === "function") {
        await cartService.restoreCarts([cartId])
      }
    }
  }
  ```
  If a failure occurs during or after deletion, Cart B is immediately restored.

### 2.4 Ownership Transfer (`transferCartCustomerWorkflow.runAsStep`)
- **Forward Action**: Sets `customer_id` on Cart B.
- **Compensation**: Reverts `customer_id` to `null`.

---

## 3. Transactional Guarantees

1. **No Phantom Deletions**: Cart B is only deleted after `addToCartWorkflow` successfully completes. If anything fails, Cart B is restored.
2. **Cart A Integrity**: Cart A reverts to its exact pre-merge state if downstream steps fail.
3. **Lock Release Guarantee**: All distributed locks on Cart A and Cart B are released unconditionally on failure.
