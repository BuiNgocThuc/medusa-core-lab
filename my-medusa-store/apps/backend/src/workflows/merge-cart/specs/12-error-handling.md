# 12 — Error Handling

## Purpose

Standardize error classifications, status codes, and failure responses across the merge cart workflow.

---

## 1. Error Types & Standards

The workflow utilizes `MedusaError` from `@medusajs/framework/utils` to maintain consistent HTTP status mapping and machine-readable error codes.

```ts
import { MedusaError } from "@medusajs/framework/utils"

throw new MedusaError(
  MedusaError.Types.NOT_FOUND,
  "Guest cart not found"
)
```

---

## 2. Error Matrix

| Scenario | Condition | MedusaError Type | HTTP Status | Message |
| :--- | :--- | :--- | :---: | :--- |
| **Missing Guest Cart** | `guest_cart_id` does not exist in DB | `NOT_FOUND` | 404 | `Cart with id '${guest_cart_id}' not found` |
| **Completed Guest Cart** | `guestCart.completed_at !== null` | `NOT_ALLOWED` | 400 | `Guest cart '${guest_cart_id}' has already completed checkout` |
| **Invalid Ownership** | `customerCart.customer_id !== input.customer_id` | `NOT_ALLOWED` | 403 | `Cart does not belong to the authenticated customer` |
| **No Eligible Items** | All Cart B items missing from Cart A's sales channel | `INVALID_DATA` | 400 | `None of the items from the guest cart are available in the customer's sales channel` |
| **Insufficient Stock** | Combined variant quantity exceeds inventory | `NOT_ALLOWED` | 400 | `Insufficient inventory for variant '${title}'` |
| **Concurrent Modification** | Lock acquisition timeout | `CONFLICT` | 409 | `Cart is currently locked by another operation. Please retry.` |

---

## 3. Client Guidance for Error Scenarios

1. **`NOT_FOUND` / `NOT_ALLOWED` (Guest Cart)**: Client should clear the stale guest cart ID from local storage / cookies and redirect the user to the active cart.
2. **`INVALID_DATA` (Sales Channel)**: Client should display a notification indicating that the items in the guest session are not available in the current region/sales channel.
3. **`CONFLICT` (Locking)**: Client should implement an exponential backoff retry (e.g. retry once after 500ms).
