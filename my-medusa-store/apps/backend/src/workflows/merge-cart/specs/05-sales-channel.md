# 05 — Sales Channel & Location Validation

## Purpose

Ensure per-Sales-Channel cart isolation and validate product variant availability in the target sales channel before attempting to merge.

---

## 1. Core Invariant

> **Mỗi Customer tại mỗi Sales Channel chỉ có TỐI ĐA 1 cart uncompleted.**
>
> Giỏ hàng giữa các Sales Channel là **hoàn toàn độc lập**: đăng nhập tại Kênh B không ảnh hưởng đến giỏ hàng ở Kênh A.

---

## 2. Sales Channel Source

- `sales_channel_id` is extracted from `req.publishable_key_context.sales_channel_ids[0]`.
- On `/store` routes, the `x-publishable-api-key` header is **mandatory** — `sales_channel_id` is always available and **required** in `MergeGuestCartInput`.
- This value is used for:
  1. **Cart Discovery**: Scoping the customer cart query to the current channel.
  2. **Cross-Channel Validation**: Rejecting merge if guest cart belongs to a different channel.
  3. **Inventory Validation**: Checking variant availability within the channel's stock locations.

---

## 3. Cross-Channel Mismatch Validation

Before merging, the workflow validates that the guest cart's `sales_channel_id` matches `input.sales_channel_id`:

```ts
const validateSalesChannelMismatchStep = createStep(
  "validate-sales-channel-mismatch",
  async (data: { guest_sales_channel_id: string | null; expected_sales_channel_id: string }) => {
    if (data.guest_sales_channel_id && data.guest_sales_channel_id !== data.expected_sales_channel_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `SALES_CHANNEL_MISMATCH: Guest cart belongs to sales channel '${data.guest_sales_channel_id}' but request targets '${data.expected_sales_channel_id}'`
      )
    }
    return new StepResponse(true)
  }
)
```

**When does this trigger?** When a guest cart was created under Publishable API Key A (Channel A), but the merge request arrives with Publishable API Key B (Channel B). This is an invalid operation — merge chéo kênh bị cấm.

---

## 4. Location Level Linking (Inventory Validation)

In Medusa v2, sales channels are connected to stock locations. A variant is only fulfillable if its inventory items are located at a stock location enabled for the target sales channel:

```text
Variant -> Inventory Item -> Location Level -> Stock Location -> Sales Channel
```

---

## 5. Implementation in `validateInventoryForMergeStep`

Sales channel checking is performed within the inventory validation step using `input.sales_channel_id` (from Publishable API Key):

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
  // Variant has no stock location linked to the target sales channel
  allCovered = false
}
```

---

## 6. Behavior Summary

| Scenario | Result |
|:---|:---|
| Guest cart same channel, variant available & in-stock | Added to `valid_items` → `addToCartWorkflow` |
| Guest cart same channel, variant not in channel or 0 stock | Added to `skipped_items` with reason `"OUT_OF_STOCK"` |
| Guest cart same channel, all items missing | Cart A remains untouched, all items in `skipped_items` |
| Guest cart **different** channel | **REJECT** with `SALES_CHANNEL_MISMATCH` error (workflow stops before inventory check) |