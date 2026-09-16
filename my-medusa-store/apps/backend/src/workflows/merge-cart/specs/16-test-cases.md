# 16 — Test Cases Matrix

## Purpose

Define the comprehensive test scenarios and assertions for automated integration tests.

---

## Test Scenarios Matrix

| ID | Category | Initial State | Execution / Action | Expected Result |
| :---: | :--- | :--- | :--- | :--- |
| **TC01** | **Transfer Path** | Cart B has 2 items.<br>Customer has **no** Cart A. | Run workflow with `guest_cart_id` and `customer_id`. | - Result: `{ cart_id: guest_cart_id, merged: false, skipped_items: [] }`<br>- Cart B `customer_id` updated to customer. |
| **TC02** | **Merge Path (Disjoint)** | Cart A has Variant 1 (qty: 1).<br>Cart B has Variant 2 (qty: 2).<br>Both in Cart A's sales channel. | Run workflow. | - Result: `{ cart_id: cartA.id, merged: true, skipped_items: [] }`<br>- Cart A has 2 line items.<br>- Prices recalculated using Cart A context. |
| **TC03** | **Merge Path (Duplicate)** | Cart A has Variant 1 (qty: 2).<br>Cart B has Variant 1 (qty: 3). | Run workflow. | - Result: `{ cart_id: cartA.id, merged: true, skipped_items: [] }`<br>- Cart A has 1 line item for Variant 1 with **accumulated quantity = 5**. |
| **TC04** | **Partial Availability** | Cart B has Variant 1 (valid) and Variant 2 (not in sales channel). | Run workflow. | - Result: `{ cart_id: cartA.id, merged: true, skipped_items: [{ variant_id: "variant_2", ... }] }`<br>- Only Variant 1 added to Cart A. |
| **TC05** | **Failure: All Unavailable** | Cart B has only Variant 2 (not in sales channel). | Run workflow. | - Throws `MedusaError.Types.INVALID_DATA`.<br>- Cart A and Cart B unchanged. |
| **TC06** | **Failure: Out of Stock** | Variant 1 requested qty exceeds available inventory. | Run workflow. | - Throws inventory confirmation error.<br>- Saga compensation rolls back all changes. |
| **TC07** | **Failure: Missing Cart B** | `guest_cart_id` does not exist in DB. | Run workflow. | - Throws `MedusaError.Types.NOT_FOUND` (404). |
| **TC08** | **Failure: Completed Cart B** | Cart B has `completed_at !== null`. | Run workflow. | - Throws `MedusaError.Types.NOT_ALLOWED` (400). |
| **TC09** | **Locking & Concurrency** | Two merge requests arrive simultaneously for same Cart A. | Run workflow concurrently. | - Distributed lock ensures sequential execution without data corruption. |
| **TC10** | **Promotion Preservation** | Cart A has `SAVE20`, Cart B has `GUEST5`. | Run workflow. | - Merged Cart A preserves `SAVE20`; `GUEST5` discarded. |
| **TC11** | **Restore Path (Cart A exists)** | Customer has Cart A in DB.<br>Customer logs in with **no guest cart**. | Run workflow with `guest_cart_id: undefined`. | - Result: `{ cart_id: cartA.id, merged: false, skipped_items: [] }`<br>- Storefront sets cookie to `cartA.id`. |
| **TC12** | **Restore Path (No Cart at all)** | Customer has no Cart A.<br>Customer logs in with **no guest cart**. | Run workflow with `guest_cart_id: undefined`. | - Result: `{ cart_id: null, merged: false, skipped_items: [] }`<br>- No cookie set; cart created on first add-to-cart. |
