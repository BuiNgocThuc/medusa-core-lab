# 05 — Sales Channel Validation

## Purpose

Validate that the product variants in Cart B are available in Cart A's sales channel before adding them to Cart A.

Cart A's sales channel is **authoritative**. Items from Cart B that do not belong to Cart A's sales channel must be filtered out and reported as skipped.

---

## 1. Core Business Rules

```text
Cart B Items
    │
    ▼
Check against Cart A Sales Channel
    │
    ├── Available   ───► validItems   ───► addToCartWorkflow (Cart A)
    │
    └── Unavailable ───► skippedItems ───► Report in workflow output
```

1. **Authoritative Sales Channel**: `Cart A.sales_channel_id` is the single source of truth. Cart A's sales channel is never modified to match Cart B.
2. **Item Eligibility**: For each line item in Cart B, check whether its `variant_id` belongs to a product published in `Cart A.sales_channel_id`.
3. **Partial Availability**: If some items are available and others are not, the merge proceeds with the available items (`validItems`). The unavailable items are collected in `skippedItems`.
4. **All Items Unavailable**: If **all** items in Cart B are unavailable in Cart A's sales channel (`validItems.length === 0`), the workflow **must throw an error** (`MedusaError.Types.INVALID_DATA`). It must not silently return a successful merge with 0 items added.

---

## 2. Querying Sales Channel Availability in Medusa v2

In Medusa v2, products are linked to sales channels via the `product_sales_channel` link. A variant is eligible if its product is assigned to `Cart A.sales_channel_id`.

### Step Implementation Pattern:
```ts
const variantSalesChannelQuery = useQueryGraphStep({
  entity: "product_variant",
  filters: { id: cartBVariantIds },
  fields: [
    "id",
    "product.sales_channels.id",
  ],
}).config({ name: "validate-variants-sales-channel" })
```

### Filtering Logic:
```ts
const targetSalesChannelId = customerCart.sales_channel_id

const validItems: Array<{ variant_id: string; quantity: number }> = []
const skippedItems: Array<{ variant_id: string; quantity: number; reason: string }> = []

for (const item of guestCart.items) {
  const variant = variantsData.find((v) => v.id === item.variant_id)
  const isAvailable = variant?.product?.sales_channels?.some(
    (sc) => sc.id === targetSalesChannelId
  )

  if (isAvailable) {
    validItems.push({
      variant_id: item.variant_id,
      quantity: item.quantity,
    })
  } else {
    skippedItems.push({
      variant_id: item.variant_id,
      quantity: item.quantity,
      reason: "Variant is unavailable in customer's sales channel",
    })
  }
}

if (guestCart.items.length > 0 && validItems.length === 0) {
  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "None of the items from the guest cart are available in the customer's sales channel"
  )
}
```

---

## 3. Separation of Concerns

- **This Step**: Decides *which* items are eligible based solely on sales channel permissions.
- **Do NOT validate inventory here**: Handled by Medusa core in [08-inventory.md](./08-inventory.md).
- **Do NOT calculate prices here**: Handled by Medusa core in [06-pricing.md](./06-pricing.md).
- **Do NOT mutate Cart A here**: Handled by `addToCartWorkflow` in [14-merge-path.md](./14-merge-path.md).