# 07 — Line Item Mapping & Accumulation

## Purpose

Define how line items from Cart B are prepared, mapped, and merged into Cart A.

---

## 1. Line Item Data Mapping

When Cart B's eligible items are passed to `addToCartWorkflow`, only essential line-item fields are mapped:

```ts
export type AddToCartItemInput = {
  variant_id: string
  quantity: number
  metadata?: Record<string, unknown>
}
```

### Mapping Transformation
```ts
const itemsToAdd = validItems.map((item) => ({
  variant_id: item.variant_id,
  quantity: item.quantity,
  metadata: item.metadata ?? undefined,
}))
```

### Fields explicitly excluded from mapping:
- `id`: Must NOT pass Cart B's line-item ID (Cart A generates its own IDs).
- `unit_price`, `raw_unit_price`: Must NOT pass prices (see [06-pricing.md](./06-pricing.md)).
- `adjustments`, `tax_lines`: Must NOT pass discounts or tax lines.
- `cart_id`: Must NOT pass Cart B's cart ID.

---

## 2. Item Duplication & Quantity Accumulation

When merging into Cart A, two scenarios occur for each variant:

### Scenario A: Variant already exists in Cart A
- **Behavior**: The quantity from Cart B is added to the existing quantity in Cart A.
```text
Cart A existing: Variant X (qty: 2)
Cart B source:   Variant X (qty: 3)
───────────────────────────────────
Result in Cart A: Variant X (qty: 5)
```
- **Medusa Core Native Support**: Handled natively by Medusa's `addToCartWorkflow`. It inspects `cart.items`, finds matching `variant_id`, and executes `updateLineItemsStep` instead of creating a duplicate line item.

### Scenario B: Variant does not exist in Cart A
- **Behavior**: A new line item is created in Cart A.
```text
Cart A existing: (none)
Cart B source:   Variant Y (qty: 1)
───────────────────────────────────
Result in Cart A: Variant Y (qty: 1)
```
- **Medusa Core Native Support**: Handled natively by Medusa's `addToCartWorkflow` via `createLineItemsStep`.

---

## 3. Metadata Merging Policy

For line items containing `metadata` (e.g. custom product notes, engraving):
1. **New Line Items**: Metadata from Cart B is copied directly to the newly created line item in Cart A.
2. **Duplicate Line Items (Quantity Accumulated)**:
   - By default, Cart A's existing metadata takes precedence to preserve customer preferences already in Cart A.

---

## 4. Invariants

1. **No Phantom Items**: Only line items identified as valid during [05-sales-channel.md](./05-sales-channel.md) are added.
2. **Cart B Integrity**: Cart B's line items remain completely unchanged in the database throughout this phase.
