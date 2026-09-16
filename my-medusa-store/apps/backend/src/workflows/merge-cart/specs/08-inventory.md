# 08 — Inventory Validation

## Purpose

Define the inventory rules governing the merge of Cart B items into Cart A.

---

## 1. Core Rule: Complete Delegation to Medusa Core

Inventory validation is **100% delegated to Medusa core**. The custom merge workflow does not implement custom inventory calculation logic.

```text
Merged Items (validItems)
        │
        ▼
addToCartWorkflow(Cart A)
        │
        ▼
confirmVariantInventoryWorkflow (Medusa Core)
        │
        ├── Checks stock locations linked to Cart A.sales_channel_id
        ├── Evaluates manage_inventory & allow_backorder flags
        └── Validates cumulative quantity:
            (Existing Cart A qty + Added Cart B qty) <= Available Stock
```

---

## 2. Cumulative Stock Confirmation

When a variant already exists in Cart A, inventory is checked against the **total combined quantity**:

```text
Cart A existing: 5 units of Variant X
Cart B adding:   3 units of Variant X
──────────────────────────────────────
Required Stock:  8 units of Variant X
```

If only 6 units are available in inventory:
- Medusa core's `confirmVariantInventoryWorkflow` throws `NOT_ALLOWED` or `INSUFFICIENT_INVENTORY`.
- The entire merge operation is aborted.

---

## 3. Atomicity & Failure Behavior

Inventory validation is strictly **atomic**:

1. **No Partial Inventory Merge**: The workflow does NOT partially add available stock while dropping the rest (e.g., adding 1 unit when 3 were requested).
2. **All-or-Nothing Rollback**: If inventory validation fails for even a single line item, the entire workflow aborts.
3. **Clean State Guarantee**:
   - Cart A remains unchanged in its pre-merge state.
   - Cart B remains unchanged.
   - Locks on Cart A are safely released.

---

## 4. Backorders & Non-Managed Inventory

Medusa's inventory engine handles special variant configurations automatically:
- **`manage_inventory = false`**: Inventory check is bypassed (always available).
- **`allow_backorder = true`**: Inventory confirmation passes regardless of current on-hand levels.
