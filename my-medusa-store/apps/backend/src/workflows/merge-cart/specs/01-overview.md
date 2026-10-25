# 01 — Overview & Core Delegation Strategy

## Purpose

Synchronize and resolve the authenticated customer's cart upon login:
1. **Merge Path**: Merge eligible items from the guest cart (Cart B) into the customer's existing cart (Cart A), gracefully skipping out-of-stock items, and clean up Cart B.
2. **Transfer Path**: Transfer the guest cart (Cart B) to the customer when no active customer cart exists.

---

## 🌟 Core-First Architecture Principle & Custom Steps

> **CRITICAL ARCHITECTURAL DIRECTIVE**:
> **Reuse Medusa Core production flows where possible, and extend with custom steps where business requirements diverge.**
> Core `addToCartWorkflow` aborts transactions when stock is insufficient. To provide a seamless e-commerce UX, our custom workflow pre-validates inventory and gracefully skips unavailable items instead of failing the entire merge.

### Components Used:

| Capability | Component | Source | Responsibility |
| :--- | :--- | :--- | :--- |
| **Ownership Transfer** | `transferCartCustomerWorkflow` | `@medusajs/medusa/core-flows` | Assigns guest cart to customer when Cart A does not exist. |
| **Inventory & Channel Validation** | `validateInventoryForMergeStep` | Custom Step | Pre-validates cumulative stock (A + B) against target sales channel locations; separates `valid_items` and `skipped_items`. |
| **Adding Items & Recalculation** | `addToCartWorkflow` | `@medusajs/medusa/core-flows` | Adds `valid_items` to Cart A, handles quantity accumulation, line-item pricing, promotions, and tax recalculation. |
| **Cart B Cleanup** | `deleteCartStep` | Custom Step | Safely deletes merged guest cart with compensation (`restoreCarts`) on rollback. |
| **Distributed Locking** | `acquireLockStep`, `releaseLockStep` | `@medusajs/medusa/core-flows` | Concurrency protection on carts. |
| **Graph Querying** | `useQueryGraphStep` | `@medusajs/medusa/core-flows` | Fetches cart data, items, and inventory graph. |

---

## High-Level Execution Flow

```text
               Input: { customer_id, guest_cart_id }
                                  │
                                  ▼
           Query Active Customer Carts (useQueryGraphStep)
                                  │
         Filter out guest_cart_id (Self-Merge Bug Prevention)
                                  │
                                  ▼
                     Does other Cart A exist?
                                  │
                  ┌───────────────┴───────────────┐
                  │                               │
             [NO Cart A]                     [YES Cart A]
                  │                               │
                  ▼                               ▼
            TRANSFER PATH                     MERGE PATH
                  │                               │
       1. Lock Cart B                  1. Dual Lock [Cart A, Cart B]
       2. transferCartCustomerWorkflow 2. Query Cart B items
       3. Unlock Cart B                3. validateInventoryForMergeStep
                  │                       (Check cumulative stock A + B)
                  │                    4. addToCartWorkflow(valid_items)
                  │                    5. deleteCartStep(Cart B)
                  │                    6. Release Dual Locks
                  ▼                               ▼
       Return { cart_id: Cart B,       Return { cart_id: Cart A,
                skipped_items: [] }             skipped_items: [...] }
```

---

## Storefront Integration Flow (`handleCustomerCartAfterLogin`)

```ts
export async function handleCustomerCartAfterLogin(customerId: string) {
  const guestCartId = await getCartId()

  if (!guestCartId) {
    return
  }

  const response = await fetch(`/store/carts/${guestCartId}/merge-customer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${customerToken}`,
    },
  })

  const { cart, skipped_items } = await response.json()

  // Set the resolved active cart ID into browser cookies
  if (cart?.id) {
    await setCartId(cart.id)
  }

  // If some items could not be merged due to inventory/channel, notify customer
  if (skipped_items && skipped_items.length > 0) {
    notifyUserSkippedItems(skipped_items)
  }

  return { cart, skipped_items }
}
```