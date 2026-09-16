# 13 — Transfer Path

## Purpose

Define the execution path when the authenticated customer does not have an existing active cart.

---

## 1. Preconditions

- Cart B (`guest_cart_id`) exists and is uncompleted.
- Cart A does not exist (`customerCart === null`).
- `customer_id` is authenticated and valid.

---

## 2. Step Sequence

```text
       Start Transfer Path
               │
               ▼
   1. Acquire Lock on Cart B
   (key: guest_cart_id, timeout: 30, ttl: 120)
               │
               ▼
   2. Execute transferCartCustomerWorkflow
   (id: guest_cart_id, customer_id: customer_id)
               │
               ▼
   3. Release Lock on Cart B
               │
               ▼
   4. Return Transfer Result
   { cart_id: guest_cart_id, merged: false, skipped_items: [] }
```

### Implementation Pattern
```ts
when("no-customer-cart", { customerCart }, ({ customerCart }) => {
  return customerCart === null
}).then(() => {
  acquireLockStep({
    key: input.guest_cart_id,
    timeout: 30,
    ttl: 120,
  })

  transferCartCustomerWorkflow.runAsStep({
    input: {
      id: input.guest_cart_id,
      customer_id: input.customer_id,
    },
  })

  releaseLockStep({
    key: input.guest_cart_id,
  })
})
```

---

## 3. Output Contract

```json
{
  "cart_id": "cart_b_guest_id",
  "merged": false,
  "skipped_items": []
}
```

---

## 4. Invariants

1. **No New Cart Created**: Do not create a new Cart C. Cart B itself becomes the customer's cart.
2. **No Line Item Mutation**: Items already in Cart B are preserved without re-insertion.
3. **No Skipped Items**: Since no merge into another sales channel occurred, `skipped_items` is always empty `[]`.
