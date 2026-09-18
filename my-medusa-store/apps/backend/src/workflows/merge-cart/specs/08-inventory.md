# 08 — Cumulative Inventory Validation & Graceful Skipping

## Purpose

Define how inventory is validated when merging items from Cart B into Cart A, ensuring combined stock accuracy and graceful error handling.

---

## 1. Cumulative Stock Calculation

When a variant exists in both Cart A and Cart B, stock availability must be validated against the **total combined quantity**:

```text
Cart A existing quantity:  5 units of Variant X
Cart B incoming quantity:  3 units of Variant X
───────────────────────────────────────────────
Total stock needed:        8 units of Variant X
```

If only 6 units are available:
- Adding 3 units would violate inventory constraints.
- Rather than crashing the entire login/merge process, Variant X is categorized as a skipped item with reason `"EXCEEDS_AVAILABLE_STOCK"`.

---

## 2. Dedicated Validation Step (`validateInventoryForMergeStep`)

Because Medusa Core's `addToCartWorkflow` aborts the entire transaction on out-of-stock items, we implemented a custom pre-validation step:

```ts
const inventoryValidationResult = validateInventoryForMergeStep(validationInput)
```

### Validation Algorithm:
1. **Aggregate Existing Quantities**: Map existing Cart A quantities by `variant_id`.
2. **Aggregate Guest Quantities**: Map incoming Cart B quantities by `variant_id`.
3. **Query Inventory Graph**:
   - `manage_inventory = false` $\rightarrow$ Valid (always available).
   - `allow_backorder = true` $\rightarrow$ Valid (backorders allowed).
   - Filter inventory location levels to only those linked to Cart A's sales channel.
4. **Confirm Stock Availability**:
   Call `inventoryService.confirmInventory(inventory_item_id, locationIds, totalNeeded)`.
5. **Partition Items**:
   - In-stock items $\rightarrow$ `valid_items`
   - Insufficient stock items $\rightarrow$ `skipped_items`

---

## 3. Reason Code Classification

| Scenario | Condition | Reported Reason |
| :--- | :--- | :--- |
| **Out of Stock** | Variant is managed, no backorder, available = 0, no items in Cart A | `"OUT_OF_STOCK"` |
| **Exceeds Combined Stock** | Cart A has items, available stock < `existingQty + guestQty` | `"EXCEEDS_AVAILABLE_STOCK"` |
| **No Stock Locations** | Managed inventory has no inventory item levels linked to sales channel | `"NO_INVENTORY_ITEMS"` |
| **Non-existent Variant** | Variant ID cannot be found in database | `"VARIANT_NOT_FOUND"` |

---

## 4. User Experience Guarantee

- **No Abortions**: A single out-of-stock item in the guest cart does not block the customer from logging in or merging other eligible items.
- **Accurate Information**: Storefront receives the complete list of `skipped_items` with item titles and reason codes to display helpful notifications to the customer.
