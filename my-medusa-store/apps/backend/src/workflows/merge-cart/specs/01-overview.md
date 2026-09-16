# 01 — Overview & Core Delegation Strategy

## Purpose

Synchronize and resolve the authenticated customer's cart upon login:
1. **Merge Path**: Merge a guest cart (Cart B) into the customer's existing cart (Cart A).
2. **Transfer Path**: Transfer the guest cart (Cart B) to the customer when no active customer cart exists.
3. **Restore Path**: Restore the customer's existing active cart (Cart A) when logging in without a guest cart.

---

## 🌟 Core-First Architecture Principle

> **CRITICAL ARCHITECTURAL DIRECTIVE**:
> **Never reinvent what Medusa Core already provides.**
> Medusa v2 provides a rich set of production-grade workflows and steps in `@medusajs/medusa/core-flows`.
> Our custom workflow acts as an orchestrator across these components.

### Exact Medusa Core Components Reused:

| Capability | Medusa Core Component | Source Package |
| :--- | :--- | :--- |
| **Ownership Transfer** | `transferCartCustomerWorkflow` | `@medusajs/medusa/core-flows` |
| **Adding Items & Merging** | `addToCartWorkflow` | `@medusajs/medusa/core-flows` |
| **Price Calculation** | `getVariantsAndItemsWithPrices` | Internal to `addToCartWorkflow` |
| **Duplicate Line Item Handling** | `getLineItemActionsStep` | Internal to `addToCartWorkflow` |
| **Inventory Validation** | `confirmVariantInventoryWorkflow` | Internal to `addToCartWorkflow` |
| **Cart & Promotion Refresh** | `refreshCartItemsWorkflow` | Internal to `addToCartWorkflow` |
| **Distributed Locking** | `acquireLockStep`, `releaseLockStep` | `@medusajs/medusa/core-flows` |
| **Graph Querying** | `useQueryGraphStep` | `@medusajs/medusa/core-flows` |

---

## High-Level Execution Flow

```text
               Customer ID + (Optional Guest Cart ID)
                                 │
                                 ▼
                 Query Customer Cart A (useQueryGraphStep)
                                 │
                 Does Guest Cart B exist in input?
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
             [YES: guestCartId]          [NO: No guestCartId]
                 │                               │
       Does Cart A exist in DB?            Does Cart A exist in DB?
        ┌────────┴────────┐               ┌────────┴────────┐
        │                 │               │                 │
    [NO Cart A]       [YES Cart A]    [YES Cart A]      [NO Cart A]
        │                 │               │                 │
        ▼                 ▼               ▼                 ▼
   TRANSFER PATH      MERGE PATH     RESTORE PATH      NO-OP (LAZY)
        │                 │               │                 │
  Transfer B to A   Merge B into A   Restore Cart A    cart_id = null
  cart_id = Cart B  cart_id = Cart A cart_id = Cart A  (Created later
                                                       on add-to-cart)
```

---

## Storefront Integration Flow (`handleCustomerCartAfterLogin`)

```ts
export async function handleCustomerCartAfterLogin(customerId: string) {
  const guestCartId = await getCartId()

  const result = await mergeGuestCartIntoCustomerCart({
    customerId,
    guestCartId,
  })

  // Set the resolved active cart ID into browser cookies
  if (result.cartId) {
    await setCartId(result.cartId)
  }

  // Purge stale cache so all RSC components re-render with fresh cart
  const cartCacheTag = await getCacheTag("carts")
  if (cartCacheTag) {
    revalidateTag(cartCacheTag)
  }

  return result
}
```