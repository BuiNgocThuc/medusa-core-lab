# 16 — Test Cases Matrix

## Purpose

Define the comprehensive test scenarios and assertions for automated integration tests and manual Postman verification.

---

## Test Scenarios Matrix

| ID | Category | Initial State | Execution / Action | Expected Result |
| :---: | :--- | :--- | :--- | :--- |
| **TC01** | **Transfer Path** | Cart B has items.<br>Customer has **no** active Cart A. | Run workflow with `guest_cart_id` and `customer_id`. | - Result: `{ cart_id: guest_cart_id, skipped_items: [] }`<br>- Cart B `customer_id` updated to customer.<br>- Cart B is preserved. |
| **TC02** | **Merge Path (Disjoint Items)** | Cart A has Variant 1 (qty: 1).<br>Cart B has Variant 2 (qty: 2).<br>Both in stock. | Run workflow. | - Result: `{ cart_id: cartA.id, skipped_items: [] }`<br>- Cart A has both line items.<br>- Prices computed in Cart A context.<br>- Cart B is deleted from database. |
| **TC03** | **Merge Path (Duplicate Items)** | Cart A has Variant 1 (qty: 2).<br>Cart B has Variant 1 (qty: 3).<br>Stock >= 5. | Run workflow. | - Result: `{ cart_id: cartA.id, skipped_items: [] }`<br>- Cart A has 1 line item for Variant 1 with **accumulated quantity = 5**.<br>- Cart B deleted. |
| **TC04** | **Partial Availability (Graceful Skip)** | Cart B has Variant 1 (in-stock) and Variant 2 (out-of-stock / channel). | Run workflow. | - Result: `{ cart_id: cartA.id, skipped_items: [{ variant_id: "variant_2", reason: "OUT_OF_STOCK" }] }`<br>- Variant 1 merged into Cart A.<br>- Cart B deleted. |
| **TC05** | **All Items Out-of-Stock** | All items in Cart B exceed stock or are unavailable. | Run workflow. | - Result: `{ cart_id: cartA.id, skipped_items: [...] }` (HTTP 200).<br>- Cart A remains unchanged.<br>- Cart B deleted. |
| **TC06** | **Self-Merge Bug Prevention** | Guest entered email at checkout before login, so Cart B already carries `customer_id`. Customer also has prior Cart A. | Run workflow. | - Workflow filters `c.id !== guest_cart_id`.<br>- Cart A is correctly identified as the prior cart.<br>- Cart B merges into Cart A and does NOT self-merge. |
| **TC07** | **Rollback & Cart B Restoration** | Merge fails mid-transaction (e.g. database error). | Simulate failure after deletion. | - Saga compensation executes `restoreCarts([cartB.id])`.<br>- Cart A reverts to pre-merge state.<br>- Cart B is restored in database. |
| **TC08** | **Failure: Missing Guest Cart** | `guest_cart_id` does not exist in DB. | Run workflow. | - Throws `MedusaError.Types.NOT_FOUND` (404). |
| **TC09** | **Failure: Completed Guest Cart** | Cart B has `completed_at !== null`. | Run workflow. | - Throws `MedusaError.Types.NOT_ALLOWED` (400). |
| **TC10** | **Concurrency Protection** | Two merge requests arrive simultaneously for same customer. | Concurrent execution. | - Dual lock ensures sequential execution without race conditions or duplicated quantities. |
