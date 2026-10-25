# 07 — Line Item Mapping & Accumulation

## Purpose

Define how line items from Cart B are prepared, mapped, and merged into Cart A.

---

## 1. Line Item Data Mapping

Only `valid_items` identified during inventory and sales channel validation are passed to Medusa Core's `addToCartWorkflow`:

```ts
addToCartWorkflow.runAsStep({
  input: {
    cart_id: customerCartTransform.id,
    items: inventoryValidationResult.valid_items,
  },
})
```

### Data Schema of `valid_items`:
```ts
{
  variant_id: string
  quantity: number
  metadata?: Record<string, unknown>
}
```

### Fields Explicitly Excluded:
- `id`: Must NOT pass Cart B's line-item ID (Medusa Core creates new line items or increments existing line item quantity).
- `unit_price`, `raw_unit_price`: Prices are dynamically computed by Medusa Core's pricing engine for Cart A's region/currency.
- `tax_lines`, `adjustments`: Computed freshly by Medusa Core.

---

## 2. Item Duplication & Quantity Accumulation

When merging into Cart A:
- **Variant already in Cart A**: Quantity is accumulated (`existing + added`). Handled natively by Medusa Core's `addToCartWorkflow`.
- **Variant new to Cart A**: Added as a new line item. Handled natively by Medusa Core.

---

## 3. Post-Merge Cleanup

After `valid_items` are successfully committed to Cart A, Cart B is deleted via `deleteCartStep` to prevent multi-device cart collisions and duplicate active carts.
