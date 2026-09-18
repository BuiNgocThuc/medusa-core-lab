# 10 — Distributed Locking & Concurrency Protection

## Purpose

Prevent race conditions and concurrent modifications during cart operations by managing distributed locks via Medusa Core's locking engine.

---

## 1. Why Parent Workflow Manages Locks

In Medusa Core (`packages/core/core-flows/src/locking/steps/acquire-lock.ts`):
```ts
const isSubWorkflow = !!parentStepIdempotencyKey
if (isSubWorkflow && !data.executeOnSubWorkflow) {
  return StepResponse.skip() as any
}
```
When `addToCartWorkflow` and `transferCartCustomerWorkflow` run as nested steps (`runAsStep`), their internal lock acquisition is automatically skipped by Medusa Core. 

**Therefore, the parent workflow (`mergeGuestCartIntoCustomerCartWorkflow`) explicitly acquires and releases distributed locks.**

---

## 2. Locking by Execution Path

### 2.1 Merge Path (Dual Locking)
Both **Cart A** and **Cart B** must be locked simultaneously:
- **Cart A**: Mutated with incoming line items.
- **Cart B**: Mutated and deleted at the end of the merge.

```ts
acquireLockStep({
  key: [customerCartTransform.id, input.guest_cart_id],
  timeout: 30, // seconds to wait
  ttl: 120,    // lock TTL
}).config({ name: "acquire-merge-locks" })

// ... Execute inventory check, addToCartWorkflow, deleteCartStep ...

releaseLockStep({
  key: [customerCartTransform.id, input.guest_cart_id],
}).config({ name: "release-merge-locks" })
```

### 2.2 Transfer Path (Single Lock)
Only **Cart B** is mutated (ownership transferred to customer):

```ts
acquireLockStep({
  key: input.guest_cart_id,
  timeout: 30,
  ttl: 120,
})

// ... Execute transferCartCustomerWorkflow ...

releaseLockStep({
  key: input.guest_cart_id,
})
```

---

## 3. Compensation Guarantee

`acquireLockStep` registers an automatic compensation handler. If any downstream step fails during execution, Medusa's Saga engine guarantees all acquired locks are released immediately.