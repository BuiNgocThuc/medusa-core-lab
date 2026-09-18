# Merge Guest Cart Into Customer Cart

## Purpose

Merge a guest cart into an authenticated customer's existing cart, or transfer the guest cart when no active customer cart exists.

## Cart Roles

- **Cart A**: Authenticated customer's existing active cart (authoritative destination).
- **Cart B**: Guest cart created before authentication (source to be merged and cleaned up).

## Main Rule

- **If Cart A does not exist** $\rightarrow$ Transfer Cart B to customer ([Transfer Path](./specs/13-transfer-path.md)).
- **If Cart A exists** $\rightarrow$ Merge eligible line items from B into A, gracefully skip out-of-stock items, and clean up Cart B ([Merge Path](./specs/14-merge-path.md)).

---

## Specifications Index

### 1. Foundation & Contracts
- [01 — Overview](./specs/01-overview.md): High-level flow, core delegation strategy, and custom steps.
- [02 — Input / Output](./specs/02-input-output.md): Input DTO, output contracts, and `SkippedCartItem` schema.
- [03 — Cart Discovery](./specs/03-cart-discovery.md): Querying Cart A and critical self-merge bug prevention.
- [04 — Cart Validation](./specs/04-cart-validation.md): Usability, active state, and context authoritativeness.

### 2. Business Rules & Delegation
- [05 — Sales Channel](./specs/05-sales-channel.md): Location level sales channel availability validation.
- [06 — Pricing](./specs/06-pricing.md): Complete delegation of pricing to `addToCartWorkflow`.
- [07 — Line Items](./specs/07-line-item.md): Payload mapping, duplicate accumulation, and post-merge cleanup.
- [08 — Inventory](./specs/08-inventory.md): Cumulative inventory validation (A + B) & graceful skip reason codes.
- [09 — Promotions](./specs/09-promotion.md): Coupon handling and automatic promotion recalculation.

### 3. Execution, Reliability & Testing
- [10 — Locking](./specs/10-locking.md): Distributed dual locking on `[Cart A, Cart B]`.
- [11 — Rollback](./specs/11-rollback.md): Saga pattern compensations including `restoreCarts` on Cart B.
- [12 — Error Handling](./specs/12-error-handling.md): Error taxonomy and graceful 200 skipped items response.
- [13 — Transfer Path](./specs/13-transfer-path.md): Sequence when no customer cart exists.
- [14 — Merge Path](./specs/14-merge-path.md): Sequence when customer cart exists.
- [15 — Scope Boundaries](./specs/15-out-of-scope.md): Implemented Cart B cleanup and deferred features.
- [16 — Test Cases](./specs/16-test-cases.md): Integration test scenarios matrix.