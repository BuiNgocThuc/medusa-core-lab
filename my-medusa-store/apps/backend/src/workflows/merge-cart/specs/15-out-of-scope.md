# 15 — Scope Boundaries & Implemented Features

## Purpose

Define the functional boundaries, implemented architectural decisions, and features deferred to future phases.

---

## 1. Features Implemented in Current Architecture

### 1.1 Cart B Cleanup (`deleteCartStep`)
- **Implemented**: Cart B is deleted from the active database upon successful completion of the merge.
- **Rationale**:
  1. **Multi-device Consistency**: Prevents a customer logging in on a second device from resuming an orphaned Cart B.
  2. **Single Active Cart Guarantee**: Avoids having multiple uncompleted carts tied to the same customer.
  3. **Transactional Safety**: Backed by a Saga compensation function (`restoreCarts`) that recovers Cart B if the transaction fails before completion.

### 1.2 Graceful Inventory Degradation
- **Implemented**: Out-of-stock items in Cart B are reported in `skipped_items` while allowing in-stock items to merge seamlessly into Cart A.

---

## 2. Deferred / Out of Scope

### 2.1 Address Merging
- Shipping and billing addresses from Cart B are **not copied** to Cart A. Cart A's existing addresses remain authoritative.

### 2.2 Payment Sessions & Collections
- Payment sessions and collections from Cart B are **not transferred**. Because cart totals and items change, payment sessions must be re-authorized on Cart A during checkout.

### 2.3 Shipping Methods
- Selected shipping methods from Cart B are **not transferred**. Shipping options must be refreshed on Cart A based on the newly merged items and package weight.

### 2.4 Multi-Cart Consolidation
- The workflow merges **one** guest cart into **one** customer cart. Merging multiple legacy carts across multiple browser sessions simultaneously is not supported.
