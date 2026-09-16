# 03 — Cart Discovery

## Purpose

Discover and resolve the carts involved in post-login synchronization:
1. **Cart A**: The authenticated customer's existing active cart.
2. **Cart B** *(optional)*: The guest cart created prior to login.

---

## 1. Discovering Cart A (Customer Cart)

Always query active carts belonging to the customer:
```ts
const cartQuery = useQueryGraphStep({
  entity: "cart",
  filters: {
    customer_id: input.customer_id,
    completed_at: null,
  },
  fields: [
    "id",
    "completed_at",
    "currency_code",
    "region_id",
    "sales_channel_id",
    "customer_id",
    "created_at",
    "items.id",
    "items.variant_id",
    "items.quantity",
  ],
}).config({ name: "get-customer-cart" })
```

### Active Cart Resolution
- Sort active carts by `created_at desc`.
- The newest active cart is selected as **Cart A**.
- If no active carts are returned, `Cart A = null`.

---

## 2. Discovering Cart B (Guest Cart)

- If `input.guest_cart_id` is provided:
  Query Cart B using `useQueryGraphStep({ entity: "cart", filters: { id: input.guest_cart_id } })`.
- If `input.guest_cart_id` is undefined:
  Cart B discovery is skipped.

---

## 3. Path Decision Matrix

| `guest_cart_id` present? | Active Cart A exists in DB? | Selected Path | Action |
| :---: | :---: | :---: | :--- |
| **No** | **Yes** | **Restore Path** | Return Cart A ID $\rightarrow$ Storefront sets cookie. |
| **No** | **No** | **No-Op** | Return `cart_id: null` $\rightarrow$ Cart created lazily on first add-to-cart. |
| **Yes** | **No** | **Transfer Path** | Transfer Cart B to customer $\rightarrow$ Return Cart B ID. |
| **Yes** | **Yes** | **Merge Path** | Merge Cart B items into Cart A $\rightarrow$ Return Cart A ID. |