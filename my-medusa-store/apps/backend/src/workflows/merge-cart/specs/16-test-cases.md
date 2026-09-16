# 16 — Test Cases Matrix

## Purpose

Define the comprehensive test scenarios and assertions for automated integration tests.

---

## Test Scenarios Matrix

| ID | Category | Initial State | Execution / Action | Expected Result |
| :---: | :--- | :--- | :--- | :--- |
| **TC01** | **Transfer Path** | Cart B has 2 items.<br>Customer has **no** Cart A. | Run workflow with `guest_cart_id` and `customer_id`. | - Result: `{ cart_id: guest_cart_id, merged: false, skipped_items: [] }`<br>- Cart B `customer_id` updated to authenticated customer.<br>- Line items remain identical. |
| **TC02** | **Merge Path (Disjoint)** | Cart A has Variant 1 (qty: 1).<br>Cart B has Variant 2 (qty: 2).<br>Both variants in Cart A's sales channel. | Run workflow. | - Result: `{ cart_id: cartA.id, merged: true, skipped_items: [] }`<br>- Cart A has 2 line items (Variant 1 qty 1, Variant 2 qty 2).<br>- Prices recalculated using Cart A's region/currency. |
| **TC03** | **Merge Path (Duplicate)** | Cart A has Variant 1 (qty: 2).<br>Cart B has Variant 1 (qty: 3). | Run workflow. | - Result: `{ cart_id: cartA.id, merged: true, skipped_items: [] }`<br>- Cart A has 1 line item for Variant 1 with **accumulated quantity = 5**.<br>- Unit price re-evaluated for tier pricing if applicable. |
| **TC04** | **Partial Availability** | Cart B has Variant 1 (available in sales channel) and Variant 2 (not in sales channel). | Run workflow. | - Result: `{ cart_id: cartA.id, merged: true, skipped_items: [{ variant_id: "variant_2", ... }] }`<br>- Only Variant 1 added to Cart A.<br>- Variant 2 listed in `skipped_items`. |
| **TC05** | **Failure: All Unavailable** | Cart B has Variant 2 (not in Cart A's sales channel). No other items. | Run workflow. | - Throws `MedusaError.Types.INVALID_DATA`.<br>- Cart A unchanged.<br>- Cart B unchanged. |
| **TC06** | **Failure: Out of Stock** | Cart A has Variant 1 (qty: 3).<br>Cart B has Variant 1 (qty: 5).<br>Available inventory is only 6. | Run workflow. | - Throws inventory confirmation error.<br>- Saga compensation rolls back all changes.<br>- Cart A line items remain at qty 3. |
| **TC07** | **Failure: Missing Cart B** | `guest_cart_id` does not exist in DB. | Run workflow. | - Throws `MedusaError.Types.NOT_FOUND` (404). |
| **TC08** | **Failure: Completed Cart B** | Cart B has `completed_at !== null`. | Run workflow. | - Throws `MedusaError.Types.NOT_ALLOWED` (400). |
| **TC09** | **Locking & Concurrency** | Two merge requests arrive simultaneously for the same Cart A. | Run workflow concurrently. | - First request acquires lock and completes.<br>- Second request waits for lock or fails gracefully with 409 without corrupted data. |
| **TC10** | **Promotion Preservation** | Cart A has promo code `SAVE20`.<br>Cart B has promo code `GUEST5`. | Run workflow. | - Merged Cart A preserves `SAVE20`.<br>- `GUEST5` is dropped.<br>- Automatic promotions re-evaluated on Cart A total. |
