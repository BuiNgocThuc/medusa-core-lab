# 03 — Cart Discovery

## Purpose

Discover and resolve the two carts involved in the operation:
1. **Cart A**: The authenticated customer's active cart (destination).
2. **Cart B**: The guest cart to be merged or transferred (source).

Cart discovery is **read-only** and acts as the initial data retrieval phase for the workflow.

---

## 1. Discovering Cart B (Guest Cart)

### Input
- `guest_cart_id`: Provided in the workflow input.

### Query Strategy
Retrieve Cart B using Medusa's Query Engine (`useQueryGraphStep`):
```ts
const guestCartQuery = useQueryGraphStep({
  entity: "cart",
  filters: { id: input.guest_cart_id },
  fields: [
    "id",
    "completed_at",
    "currency_code",
    "region_id",
    "sales_channel_id",
    "customer_id",
    "items.id",
    "items.title",
    "items.variant_id",
    "items.quantity",
    "items.metadata",
  ],
}).config({ name: "get-guest-cart" })
```

### Discovery Invariant for Cart B
- If Cart B does not exist or `completed_at !== null`, the workflow must immediately terminate with an error (see [04-cart-validation.md](./04-cart-validation.md)).

---

## 2. Discovering Cart A (Customer Cart)

### Input
- `customer_id`: Provided in the workflow input.

### Active Cart Definition
In Medusa, a customer may have historical completed carts. An **active** customer cart is defined as:
- `customer_id === input.customer_id`
- `completed_at === null`

### Query Strategy
Query all active carts belonging to the customer:
```ts
const customerCartQuery = useQueryGraphStep({
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

### Multiple Active Carts Resolution
If a customer has more than one active cart (e.g., opened in multiple sessions):
1. Sort active carts by `created_at` in descending order (`created_at desc`).
2. Select the most recently created active cart as the canonical **Cart A**.
3. If no active carts are returned, `Cart A = null`.

---

## 3. Discovery Output

The discovery phase outputs the resolved carts to the subsequent workflow steps:

```ts
type CartDiscoveryResult = {
  guestCart: Cart
  customerCart: Cart | null
}
```

```text
                    ┌─────────────────────────┐
                    │      Cart Discovery     │
                    └────────────┬────────────┘
                                 │
                     Does Customer Cart exist?
                                / \
                              No   Yes
                              /     \
                             v       v
                     Cart A = null   Cart A = customerCart
```

---

## 4. Next Step Transition
- **If `customerCart === null`**: The workflow transitions to [13-transfer-path.md](./13-transfer-path.md).
- **If `customerCart !== null`**: The workflow transitions to [04-cart-validation.md](./04-cart-validation.md) and [05-sales-channel.md](./05-sales-channel.md) (Merge Path).