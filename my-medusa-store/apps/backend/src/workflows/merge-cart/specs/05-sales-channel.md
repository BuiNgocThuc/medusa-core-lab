# 05 — Sales Channel & Location Validation

## Purpose

Ensure product variants from Cart B are available in Cart A's target sales channel before attempting to add them.

---

## 1. Core Principles

1. **Authoritative Sales Channel**: `Cart A.sales_channel_id` is the single source of truth.
2. **Location Level Linking**: In Medusa v2, sales channels are connected to stock locations. A variant is only fulfillable if its inventory items are located at a stock location enabled for Cart A's sales channel:
   ```text
   Variant -> Inventory Item -> Location Level -> Stock Location -> Sales Channel
   ```
3. **Graceful Degradation**: Items not assigned to or out-of-stock in Cart A's sales channel are routed to `skipped_items` rather than crashing the workflow.

---

## 2. Implementation in `validateInventoryForMergeStep`

Sales channel checking is performed directly within the inventory validation step:

```ts
// Filter location IDs associated with the target sales channel
let locationIds: string[] = []
if (input.sales_channel_id) {
  locationIds = locationLevels
    .filter((lvl: any) => {
      const stockLocations = Array.isArray(lvl.stock_locations)
        ? lvl.stock_locations
        : lvl.stock_locations
        ? [lvl.stock_locations]
        : []
      return stockLocations.some((loc: any) => {
        const salesChannels = Array.isArray(loc.sales_channels)
          ? loc.sales_channels
          : loc.sales_channels
          ? [loc.sales_channels]
          : []
        return salesChannels.some((sc: any) => sc.id === input.sales_channel_id)
      })
    })
    .map((lvl: any) => lvl.location_id)
}

if (locationIds.length === 0) {
  // Variant has no stock location linked to Cart A's sales channel
  allCovered = false
}
```

---

## 3. Behavior

- **Available in Channel & In-Stock**: Added to `valid_items` and passed to `addToCartWorkflow`.
- **Not in Channel or 0 Stock**: Separated into `skipped_items` with reason `"OUT_OF_STOCK"`.
- **All Items Missing**: Cart A remains untouched, and all items are returned in `skipped_items`.