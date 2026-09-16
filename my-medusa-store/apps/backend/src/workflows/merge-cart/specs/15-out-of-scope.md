# 15 — Out of Scope (Phase 1)

## Purpose

Define the explicit functional boundaries and items deferred to future phases.

---

## 1. Out of Scope for Phase 1

### 1.1 Cart B Deletion
- In Phase 1, Cart B is **NOT deleted** after a successful merge.
- **Reason**: Preserves an audit trail and prevents data loss in case of downstream network dropouts. The client application is responsible for switching its active session/cookie to Cart A's ID.

### 1.2 Address Merging
- Shipping and billing addresses from Cart B are **not copied** to Cart A.
- Cart A's existing addresses remain authoritative.

### 1.3 Payment Sessions & Collections
- Payment sessions and payment collections on Cart B are **not transferred**.
- Because cart totals change when items are merged, the customer must select or re-authorize payment methods on Cart A during checkout.

### 1.4 Shipping Methods
- Selected shipping methods from Cart B are **not transferred**.
- Shipping options must be recalculated on Cart A based on the newly merged package weight/dimensions and Cart A's destination address.

### 1.5 Partial Inventory Split
- If an item in Cart B has quantity 5, but only 3 are in stock, the workflow does **not** perform a partial addition of 3 units.
- The workflow follows an **all-or-nothing** transactional guarantee (see [08-inventory.md](./08-inventory.md)).

### 1.6 Multi-Cart Consolidation
- The workflow only supports merging **one** guest cart into **one** customer cart. Consolidating multiple legacy guest carts into a single cart is not supported in this phase.
