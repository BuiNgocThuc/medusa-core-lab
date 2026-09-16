# 10 — Distributed Locking & Core Sub-Workflow Behavior

## Purpose

Prevent race conditions and concurrent modifications during cart operations by managing distributed locks via Medusa Core's locking engine.

---

## 1. How Medusa Core Handles Locks in Sub-Workflows

An essential architectural behavior discovered directly from Medusa Core (`packages/core/core-flows/src/locking/steps/acquire-lock.ts`):

```ts
// From Medusa Core source code:
const isSubWorkflow = !!parentStepIdempotencyKey
if (isSubWorkflow && !data.executeOnSubWorkflow) {
  return StepResponse.skip() as any
}
```

### Why the Parent Workflow Must Own the Lock:
- Both `addToCartWorkflow` and `transferCartCustomerWorkflow` have internal `acquireLockStep` calls.
- **HOWEVER**, when they are executed as nested sub-workflows via `.runAsStep()`, Medusa Core's `acquireLockStep` **automatically skips execution** (`StepResponse.skip()`) because `executeOnSubWorkflow` is not set.
- **Therefore, the parent workflow (`mergeGuestCartIntoCustomerCartWorkflow`) MUST explicitly acquire and release the lock**, ensuring full concurrency protection throughout the entire workflow execution.

---

## 2. Locking by Execution Path

### 2.1 Merge Path (Cart A exists)
- **Target**: Cart A (`customerCart.id`).
- **Cart B**: Read-only during merge, so does not require locking.
- **Sequence**:
  1. Acquire lock on Cart A before any inspection or mutation.
  2. Execute `addToCartWorkflow.runAsStep(...)` (its internal lock is safely skipped by Core).
  3. Release lock on Cart A in the final step or on compensation.

```ts
acquireLockStep({
  key: customerCart.id,
  timeout: 30, // seconds
  ttl: 120,    // seconds
})

// ... run addToCartWorkflow ...

releaseLockStep({
  key: customerCart.id,
})
```

### 2.2 Transfer Path (Cart A does not exist)
- **Target**: Cart B (`input.guest_cart_id`).
- **Sequence**:
  1. Acquire lock on Cart B.
  2. Execute `transferCartCustomerWorkflow.runAsStep(...)`.
  3. Release lock on Cart B.

```ts
acquireLockStep({
  key: input.guest_cart_id,
  timeout: 30,
  ttl: 120,
})

// ... run transferCartCustomerWorkflow ...

releaseLockStep({
  key: input.guest_cart_id,
})
```

---

## 3. Lock Configuration Parameters

| Parameter | Recommended Value | Rationale |
| :--- | :---: | :--- |
| `key` | `cart.id` | Lock key scoped specifically to the cart being mutated. |
| `timeout` | `30` | Number of seconds to wait if another request is currently holding the lock. |
| `ttl` | `120` | Distributed lock TTL in seconds (prevents deadlocks if worker crashes). |

---

## 4. Automatic Lock Release on Failure

`acquireLockStep` in Medusa Core registers a compensation handler that automatically calls `locking.release(keys)`. If downstream steps throw an error, Medusa's Saga compensation engine guarantees the lock is immediately released.