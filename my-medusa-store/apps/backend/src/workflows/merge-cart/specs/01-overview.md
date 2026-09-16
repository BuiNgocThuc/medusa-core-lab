# 01 — Overview

## Purpose

Merge a guest cart into the authenticated customer's existing cart.

The workflow has two possible paths:

1. Transfer path — customer does not have an existing cart.
2. Merge path — customer already has an existing cart.

---

## Cart Roles

### Cart A — Customer Cart

Cart A is the authenticated customer's existing cart.

Cart A is the destination/canonical cart.

When Cart A exists, its context remains authoritative.

### Cart B — Guest Cart

Cart B is the guest cart created before authentication.

Cart B is the source cart.

Its line items may be merged into Cart A.

---

## Core Business Rules

1. Do not create Cart C.
2. If Cart A does not exist, transfer Cart B to the customer.
3. If Cart A exists, merge eligible line items from B into A.
4. Cart A remains the canonical cart.
5. Cart B must not overwrite Cart A's cart-level context.
6. Prices from Cart B must not be copied directly.
7. Pricing must be recalculated using Cart A's context.
8. Inventory validation must be delegated to Medusa core.
9. Items unavailable in Cart A's sales channel are skipped.
10. If all source items are unavailable, the workflow fails.
11. If inventory validation fails, the whole merge fails.
12. Phase 1 does not delete Cart B.
13. Explicit promotion codes from Cart B are not transferred.
14. Automatic promotions may be recalculated by Medusa.

---

## High-Level Flow

```text
Guest Cart B
     |
     v
Find Customer Cart A
     |
     +----------------------+
     |                      |
     v                      v
A does not exist         A exists
     |                      |
     v                      v
Transfer B             Validate A + B
to customer                 |
                            v
                     Check Sales Channel
                            |
                     +------+------+
                     |             |
                   valid         skipped
                     |             |
                     +------+------+
                            |
                            v
                    valid items exist?
                       /          \
                     no            yes
                     |              |
                   throw            v
                              Lock Cart A
                                   |
                                   v
                          addToCartWorkflow
                                   |
                                   v
                           Recalculate Cart A
                                   |
                                   v
                             Release Lock
                                   |
                                   v
                                Result