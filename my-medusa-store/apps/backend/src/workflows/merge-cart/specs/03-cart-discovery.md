# 03 — Cart Discovery & Self-Merge Prevention

## Purpose

Discover and resolve whether the authenticated customer has an existing active cart (Cart A) prior to executing merge or transfer logic.

---

## 1. Discovering Customer Cart A

The workflow searches for uncompleted carts associated with `customer_id`:

```ts
const customerCart = useQueryGraphStep({
  entity: "cart",
  filters: {
    customer_id: input.customer_id,
    completed_at: null,
  },
  fields: [
    "id",
    "email",
    "customer_id",
    "currency_code",
    "region_id",
    "sales_channel_id",
    "completed_at",
    "created_at",
    "updated_at",
    "items.id",
    "items.title",
    "items.variant_title",
    "items.variant_id",
    "items.quantity",
  ],
}).config({ name: "get-customer-cart" })
```

---

## 2. 🛡️ Critical: Self-Merge Prevention Rule

```ts
const otherCarts = carts.filter((c) => c.id !== input.guest_cart_id)
```

### Why Must `guest_cart_id` Be Excluded?
1. **Medusa Core Behavior**: If a guest shopper reaches the checkout screen and enters their email before logging in, Medusa Core's `updateCartWorkflow` executes `findOrCreateCustomerStep`. If that email corresponds to an existing customer account, Medusa automatically associates the guest cart with `customer_id`.
2. **The Bug Without Exclusion**: When the user subsequently logs in, the query for `customer_id` will return the guest cart itself. Because it was just modified, it has a newer `updated_at` than the customer's prior Cart A. If not excluded, the workflow would select `guest_cart_id` as Cart A and attempt to merge the guest cart into itself!
3. **The Solution**: By explicitly filtering `c.id !== input.guest_cart_id`, we guarantee that only genuine pre-existing customer carts qualify as Cart A.

---

## 3. Active Cart Selection

Among the filtered candidate carts (`otherCarts`):
1. **Sort by activity**: Carts are sorted by `updated_at || created_at` in descending order.
2. **Select newest**: The most recently updated cart is chosen as **Cart A**.
3. **Fallback**: If `otherCarts.length === 0`, `Cart A = null`.

---

## 4. Path Decision Matrix

| Active Cart A in DB (Excluding Guest Cart)? | Selected Path | Action Taken |
| :---: | :---: | :--- |
| **No (`Cart A === null`)** | **Transfer Path** | Transfer ownership of `guest_cart_id` to customer via `transferCartCustomerWorkflow`. |
| **Yes (`Cart A !== null`)** | **Merge Path** | Acquire dual locks, validate inventory (A + B), add `valid_items` to Cart A, delete Cart B via `deleteCartStep`. |