# 12 — Error Handling & Response Mapping

## Purpose

Standardize error classifications, HTTP status codes, and failure responses across the merge cart workflow and Store API.

---

## 1. Error Matrix

| Scenario | Condition | Handled By | HTTP Status | Response Payload / Effect |
| :--- | :--- | :--- | :---: | :--- |
| **Unauthenticated Request** | Missing/Invalid JWT token | Store API Middleware | `401 Unauthorized` | `{ "message": "Unauthorized" }` |
| **Missing Guest Cart** | `guest_cart_id` does not exist | `get-guest-cart` step | `404 Not Found` | `{ "type": "not_found", "message": "Cart with id '...' not found" }` |
| **Completed Guest Cart** | `guestCart.completed_at !== null` | Pre-validation | `400 Bad Request` | `{ "type": "not_allowed", "message": "Guest cart has already been completed" }` |
| **Insufficient Stock / OOS** | Inventory unavailable or exceeds combined qty | `validateInventoryForMergeStep` | `200 OK` (Graceful) | Items placed in `skipped_items` array with specific reason; eligible items merged into Cart A. |
| **Concurrent Modification** | Lock acquisition timeout | `acquireLockStep` | `409 Conflict` | `{ "type": "conflict", "message": "Cart is currently locked by another operation" }` |

---

## 2. Client Handling Strategy

1. **`skipped_items` in 200 OK**:
   - The Storefront should inspect `skipped_items`. If not empty, display a toast or modal to inform the customer which items could not be merged and why (e.g. *"Item X is out of stock and was removed from your cart"*).
2. **`404 Not Found`**:
   - Client should clear the stale guest cart cookie and navigate directly to the customer's active cart.
3. **`409 Conflict`**:
   - Client should retry after a brief exponential backoff (e.g. 500ms).
