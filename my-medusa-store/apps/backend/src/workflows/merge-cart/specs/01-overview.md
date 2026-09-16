# 01 — Overview & Core Delegation Strategy

## Purpose

Merge a guest cart (Cart B) into the authenticated customer's existing cart (Cart A), or transfer the guest cart when no active customer cart exists.

---

## 🌟 Core-First Architecture Principle

> **CRITICAL ARCHITECTURAL DIRECTIVE**:
> **Never reinvent what Medusa Core already provides.**
> Medusa v2 provides a rich set of production-grade workflows and steps in `@medusajs/medusa/core-flows`.
> Our custom workflow acts solely as a lightweight **orchestrator**: it discovers, validates eligibility, and delegates 100% of the actual commerce operations to Medusa Core workflows.

### Exact Medusa Core Components Reused:

| Capability | Medusa Core Component | Source Package | Why We Do NOT Write Custom Code |
| :--- | :--- | :--- | :--- |
| **Ownership Transfer** | `transferCartCustomerWorkflow` | `@medusajs/medusa/core-flows` | Natively updates `customer_id`, customer email, refreshes items, and emits events. |
| **Adding Items & Merging** | `addToCartWorkflow` | `@medusajs/medusa/core-flows` | Natively recalculates prices, accumulates duplicate variant quantities, confirms inventory, and refreshes cart. |
| **Price Calculation** | `getVariantsAndItemsWithPrices` | Internal to `addToCartWorkflow` | Resolves currency, region, customer groups, and price lists. |
| **Duplicate Line Item Handling** | `getLineItemActionsStep` | Internal to `addToCartWorkflow` | Automatically splits items into `itemsToCreate` vs `itemsToUpdate` (increments qty). |
| **Inventory Validation** | `confirmVariantInventoryWorkflow` | Internal to `addToCartWorkflow` | Checks stock locations associated with the sales channel, backorders, and inventory levels. |
| **Cart & Promotion Refresh** | `refreshCartItemsWorkflow` | Internal to `addToCartWorkflow` | Re-evaluates taxes, shipping methods, and automatic discounts. |
| **Distributed Locking** | `acquireLockStep`, `releaseLockStep` | `@medusajs/medusa/core-flows` | Manages Redis / Postgres distributed locks. |
| **Graph Querying** | `useQueryGraphStep` | `@medusajs/medusa/core-flows` | Resolves entities across module boundaries. |

---

## Cart Roles

### Cart A — Customer Cart
- Authenticated customer's existing active cart (`completed_at: null`).
- **Authoritative canonical cart**: Its currency, region, sales channel, and addresses are preserved.

### Cart B — Guest Cart
- Anonymous cart created before login (`guest_cart_id`).
- **Source cart**: Used as a data source for line items. In Phase 1, it is read-only during merge and not deleted.

---

## High-Level Execution Flow

```text
               Guest Cart B + Customer ID
                           │
                           ▼
             1. Query Carts (useQueryGraphStep)
                           │
           Does active Customer Cart A exist?
                           │
            ┌──────────────┴──────────────┐
            │                             │
    [NO: Cart A == null]          [YES: Cart A exists]
            │                             │
            ▼                             ▼
     TRANSFER PATH                   MERGE PATH
            │                             │
  acquireLockStep(Cart B)       acquireLockStep(Cart A)
            │                             │
  transferCartCustomerWorkflow  Filter Cart B items against
      .runAsStep()              Cart A sales channel
            │                             │
  releaseLockStep(Cart B)       addToCartWorkflow
            │                       .runAsStep(validItems)
            │                             │
            │                   releaseLockStep(Cart A)
            │                             │
            ▼                             ▼
   Result: { merged: false }     Result: { merged: true }
```

---

## Core Business Rules

1. **Do not create a third cart (Cart C)**: Either Cart B is transferred, or Cart B's items are added to Cart A.
2. **Preserve Cart A Context**: Region, currency, and sales channel of Cart A are never changed.
3. **No Price Copying**: Prices from Cart B are ignored; `addToCartWorkflow` recalculates all prices.
4. **Pre-filter Sales Channel Only**: The only custom step we introduce is checking if Cart B variants belong to Cart A's sales channel, so unavailable variants can be gracefully reported as `skipped_items` instead of crashing the entire operation.
5. **Atomic All-or-Nothing Inventory**: If `addToCartWorkflow` detects insufficient stock for any merged item, it aborts the entire merge transaction.
6. **No Coupon Code Transfer**: Guest promo codes are discarded; active Cart A promo codes are preserved; automatic promotions are recalculated by Core.