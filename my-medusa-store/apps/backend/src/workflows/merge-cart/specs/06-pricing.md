# 06 — Pricing Recalculation

## Purpose

Define the pricing rules when merging items from Cart B into Cart A.

Prices from Cart B must **never be copied directly** into Cart A. All item prices must be recalculated using Cart A's authoritative pricing context.

---

## 1. Core Pricing Rules

```text
Cart B Items (Prices Ignored)
        │
        ▼ (variant_id, quantity only)
addToCartWorkflow(Cart A)
        │
        ▼
Medusa Pricing Engine
├── Region: Cart A.region_id
├── Currency: Cart A.currency_code
├── Customer: Cart A.customer_id & customer groups
└── Price Lists / Sales Channel of Cart A
        │
        ▼
Calculated Unit Price for Cart A
```

1. **Cart B Prices are Ignored**: Historical or snapshot prices from Cart B's `unit_price`, `raw_unit_price`, or adjustments are discarded.
2. **Cart A Context is Authoritative**:
   - `Cart A.currency_code` determines the currency.
   - `Cart A.region_id` determines the region-based pricing rules and tax rates.
   - `Cart A.customer_id` allows Medusa's pricing module to apply customer-group specific price lists if applicable.
3. **No Currency Mismatch Conflicts**: Even if Cart B was created in USD and Cart A is in EUR, items added to Cart A are priced in EUR according to Cart A's pricing matrix.

---

## 2. Delegation to Medusa Core

Pricing is 100% delegated to Medusa's built-in `addToCartWorkflow`.

### Input passed to `addToCartWorkflow`:
```ts
items: validItems.map((item) => ({
  variant_id: item.variant_id,
  quantity: item.quantity,
  // DO NOT pass unit_price!
}))
```

When `unit_price` is omitted, Medusa core's `getVariantsAndItemsWithPrices` step automatically resolves the correct price based on Cart A's pricing context.

---

## 3. Volume and Quantity-Tiered Pricing

If a variant has quantity-tiered pricing (e.g., 1-9 items = $10 each, 10+ items = $8 each):
- When Cart A already has 8 units of Variant X and Cart B has 3 units of Variant X:
  - The merged quantity becomes 11 units.
  - Medusa's `getLineItemPricingQuantitiesStep` automatically recalculates the unit price for the cumulative quantity (11 units), unlocking the higher tier discount.

---

## 4. Taxes and Surcharges

- Tax lines are **not** copied from Cart B.
- Medusa core's tax calculation steps recalculate taxes dynamically based on `Cart A.shipping_address` and `Cart A.region`.
