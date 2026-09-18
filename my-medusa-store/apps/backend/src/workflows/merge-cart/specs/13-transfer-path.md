# 13 — Transfer Path

## Purpose

Define the execution path when the authenticated customer does not have any other existing active cart (Cart A).

---

## 1. Preconditions

- `guest_cart_id` exists in database and is uncompleted.
- Customer has no other active cart (`customerCartTransform === null`).
- `customer_id` is authenticated.

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
    { cart_id: guest_cart_id, skipped_items: [] }
```

### Implementation Code Pattern

```ts
when("transfer-guest-cart", { customerCartTransform, input }, ({ customerCartTransform, input }) => {
  return customerCartTransform === null && !!input.guest_cart_id
}).then(() => {
  acquireLockStep({
    key: input.guest_cart_id!,
    timeout: 30,
    ttl: 120,
  })

  transferCartCustomerWorkflow.runAsStep({
    input: {
      id: input.guest_cart_id!,
      customer_id: input.customer_id,
    },
  })

  releaseLockStep({ key: input.guest_cart_id! })
})
```

---

## 3. Output Contract

```json
{
  "cart_id": "cart_01M2GUEST...",
  "skipped_items": []
}
```

---

## 4. Invariants

1. **No Duplicate Cart**: Guest Cart B itself is adopted by the customer, becoming their primary active cart.
2. **Item Preservation**: All items and current prices in Cart B are preserved without re-insertion.
3. **Empty Skipped Items**: Because no merge or channel change occurred, `skipped_items` is always empty `[]`.
