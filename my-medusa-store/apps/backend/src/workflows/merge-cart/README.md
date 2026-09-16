# Merge Guest Cart Into Customer Cart

## Purpose

Merge a guest cart into an authenticated customer's existing cart, or transfer the guest cart when no active customer cart exists.

## Cart Roles

- **Cart A**: Authenticated customer's existing active cart (authoritative destination).
- **Cart B**: Guest cart created before authentication (source).

## Main Rule

- **If Cart A does not exist** $\rightarrow$ Transfer Cart B to customer ([Transfer Path](./specs/13-transfer-path.md)).
- **If Cart A exists** $\rightarrow$ Merge eligible line items from B into A ([Merge Path](./specs/14-merge-path.md)).

---

## Specifications Index

### 1. Foundation & Contracts
- [01 — Overview](./specs/01-overview.md): High-level flow, core business rules, and architecture.
- [02 — Input / Output](./specs/02-input-output.md): Input DTO, output contracts, and conceptual models.
- [03 — Cart Discovery](./specs/03-cart-discovery.md): Querying Cart A and Cart B via `useQueryGraphStep`.
- [04 — Cart Validation](./specs/04-cart-validation.md): Read-only validation of ownership, state, and context.

### 2. Business Rules & Delegation
- [05 — Sales Channel](./specs/05-sales-channel.md): Variant availability against Cart A's sales channel.
- [06 — Pricing](./specs/06-pricing.md): Complete delegation of pricing to `addToCartWorkflow`.
- [07 — Line Items](./specs/07-line-item.md): Payload mapping, duplicate accumulation, and metadata.
- [08 — Inventory](./specs/08-inventory.md): Delegation to `confirmVariantInventoryWorkflow` & atomicity.
- [09 — Promotions](./specs/09-promotion.md): Coupon handling and automatic promotion recalculation.

### 3. Execution, Reliability & Testing
- [10 — Locking](./specs/10-locking.md): Distributed locking via `acquireLockStep` and `releaseLockStep`.
- [11 — Rollback](./specs/11-rollback.md): Saga pattern compensations and transactional integrity.
- [12 — Error Handling](./specs/12-error-handling.md): Standard error taxonomy and HTTP status mapping.
- [13 — Transfer Path](./specs/13-transfer-path.md): Sequence when no customer cart exists.
- [14 — Merge Path](./specs/14-merge-path.md): Sequence when customer cart exists.
- [15 — Out of Scope](./specs/15-out-of-scope.md): Explicit boundaries and deferred features for Phase 1.
- [16 — Test Cases](./specs/16-test-cases.md): Integration test scenarios matrix.