# 09 — Promotions & Discounts

## Purpose

Define the promotion and discount behavior during the cart merge operation.

---

## 1. Explicit Promotion Codes (Coupon Codes)

### Core Rule: Cart B Coupon Codes Are NOT Transferred
Any explicit promotion code applied to Cart B is **discarded** and not copied to Cart A:

```text
Cart B Promo Code ("GUEST10") ───► DISCARDED / NOT COPIED

Cart A Promo Code ("VIP20")   ───► PRESERVED on Cart A
```

### Rationale:
1. **Cart A Authoritativeness**: Cart A is the canonical cart; its active discounts take precedence.
2. **Eligibility Conflicts**: A promotion code applied to a guest might not be valid for an authenticated customer or might conflict with promotions already applied to Cart A.
3. **Single Code Constraints**: Many stores only allow one promotional code per cart. Overwriting Cart A's code with Cart B's code could degrade the customer's savings.

---

## 2. Line Item Adjustments

- Historical line item adjustments from Cart B (`line_item_adjustments`) are **not copied**.
- All adjustments in Cart A are computed dynamically by Medusa's promotion engine.

---

## 3. Automatic Promotions

Medusa v2 supports **Automatic Promotions** (promotions applied without requiring a coupon code, such as *"Buy 2 Get 1 Free"* or *"10% off carts over $100"*).

### Behavior:
1. When new items are added to Cart A, `addToCartWorkflow` invokes `refreshCartItemsWorkflow`.
2. The Medusa promotion module automatically re-evaluates all active automatic promotions against the new line items and total cart value of Cart A.
3. If the combined quantity or cart total qualifies Cart A for a new or higher discount, it is applied automatically.

---

## 4. Invariants

1. **No Promotion Duplication**: Discounts are not duplicated or carried over as static values.
2. **Recalculation by Core**: All promotional adjustments on Cart A are strictly managed by Medusa's Promotion Module.
