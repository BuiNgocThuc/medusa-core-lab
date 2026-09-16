# 10 — Distributed Locking

## Purpose

Prevent race conditions and concurrent modifications during cart transfer and cart merge operations.

---

## 1. Locking Principle in Medusa Workflows

When executing a nested workflow (such as `addToCartWorkflow` or `transferCartCustomerWorkflow`) as a step via `.runAsStep()`, the **parent workflow must manage the distributed lock**.

Nested workflows run within the parent transaction and do not manage an independent lock lifecycle.

---

## 2. Locking by Execution Path

### 2.1 Merge Path (Cart A exists)
- **Target**: Cart A (`customerCart.id`).
- **Cart B**: Cart B is read-only during the merge phase, so acquiring a lock on Cart B is not strictly required.
- **Locking Scope**: Cart A is locked before items are evaluated and modified, and released upon completion or failure.

```ts
acquireLockStep({
  key: customerCart.id,
  timeout: 30, // Max seconds to wait for acquiring the lock
  ttl: 120,    // Lock time-to-live in seconds
})

// ... execute addToCartWorkflow ...

releaseLockStep({
  key: customerCart.id,
})
```

### 2.2 Transfer Path (Cart A does not exist)
- **Target**: Cart B (`guest_cart_id`).
- **Locking Scope**: Cart B is locked to prevent another concurrent request from transferring or modifying the guest cart simultaneously.

```ts
acquireLockStep({
  key: input.guest_cart_id,
  timeout: 30,
  ttl: 120,
})

// ... execute transferCartCustomerWorkflow ...

releaseLockStep({
  key: input.guest_cart_id,
})
```

---

## 3. Lock Configuration Parameters

| Parameter | Value | Description |
| :--- | :---: | :--- |
| `key` | `cart.id` | The unique lock identifier (scoped to the cart ID). |
| `timeout` | `30` | Number of seconds to wait before timing out if the cart is locked by another operation. |
| `ttl` | `120` | Time-to-live in seconds (prevents deadlocks if a server worker crashes unexpectedly). |

---

## 4. Compensation & Rollback

- If the workflow encounters an error while holding a lock, the Saga compensation handler must guarantee that `releaseLockStep` is invoked so the cart is not left permanently locked.