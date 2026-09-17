# Kỹ thuật học được từ ba Promotion Server Guides

Ba feature Customer Tier, First-Purchase Discount và Loyalty System là một mini curriculum tốt để học cách xây business feature trong Medusa.

| Kỹ thuật | Customer Tier | First Purchase | Loyalty | Bài học |
| --- | --- | --- | --- | --- |
| Custom Module | Tier Module | Không cần | Loyalty Module | Chỉ tạo module khi feature có state/model/service riêng. |
| Data model | Tier, TierRule | Customer/Order có sẵn | LoyaltyPoint | Model là nguồn chân lý của business state. |
| Module Link | Customer ↔ Tier, Tier ↔ Promotion | Không cần | Không cần | Giữ module isolation. |
| Workflow | Create/update/assign/apply tier | Auto apply first promo | Earn/redeem/apply/remove points | Business logic không nằm trong route. |
| Subscriber | `order.placed`, `cart.updated` | `cart.created`, `cart.customer_transferred` | `order.placed` | Dùng event cho logic theo lifecycle. |
| Workflow hook | Validate tier promotion | Validate first order | Validate loyalty balance | Backend là hàng rào cuối của rule. |
| Promotion pattern | Promotion theo Tier | Static code | Dynamic one-time promotion | Promotion không chỉ là coupon. |

## 1. Chọn giữa Workflow và Custom Module

First Purchase chỉ dùng data core có sẵn:

```text
customer.has_account
customer.orders.length
promotion code
```

Nó phù hợp với workflow + subscriber + hook.

Customer Tier cần state riêng:

```text
Tier
TierRule
Customer ↔ Tier link
Tier ↔ Promotion link
```

Loyalty cũng cần state riêng:

```text
LoyaltyPoint
customer_id
points
```

Quy tắc:

> Nếu feature chỉ orchestration core data, dùng workflow. Nếu feature có model, service và lifecycle riêng, tạo Custom Module.

## 2. Workflow là nơi đặt business logic

Route nên mỏng:

```text
HTTP route
  → auth/validate request
  → run workflow
  → return result
```

Workflow nên chứa các rule như:

```text
- Customer thuộc tier nào?
- Customer có phải first-time customer?
- Customer còn đủ points không?
- Loyalty promotion dùng một lần được tạo thế nào?
```

Lợi ích:

- Reuse từ API, subscriber hoặc job.
- Có compensation/rollback.
- Dễ test.
- Dễ thêm lock/idempotency.

## 3. Event-driven architecture

| Event | Feature | Lý do |
| --- | --- | --- |
| `cart.created` | First Purchase | Có thể add promotion ngay khi tạo cart. |
| `cart.customer_transferred` | First Purchase | Guest cart chỉ biết customer sau login/register. |
| `cart.updated` | Customer Tier | Cart thay đổi thì cần kiểm tra/apply tier promotion. |
| `order.placed` | Customer Tier | Order là nguồn tính lifetime spend. |
| `order.placed` | Loyalty | Chỉ thay đổi point balance khi order hoàn tất. |

> Cart là state tạm thời; Order là event bền vững để thay đổi tier/reward/points.

## 4. Ba cách dùng Promotion Module

### Static promotion

```text
FIRST_PURCHASE
```

Promotion được tạo sẵn, workflow chỉ add code.

### Rule-based promotion

```text
Customer → Tier Silver → Tier.promo_id → Promotion Silver
```

Tier quyết định customer có quyền dùng promotion nào.

### Dynamic one-time promotion

```text
Customer redeem points
  → tạo promotion riêng
  → rule customer_id = customer hiện tại
  → campaign usage limit = 1
  → add promotion vào cart
```

Promotion vừa tính discount, vừa giới hạn quyền sử dụng discount.

## 5. Defense in depth bằng workflow hooks

Automation chỉ cải thiện UX, không bảo vệ business rule.

```text
updateCartPromotionsWorkflow.validate
→ chặn add promotion sai

completeCartWorkflow.validate
→ kiểm tra lại ngay trước khi tạo order
```

Ví dụ cần validate:

```text
FIRST_PURCHASE → customer có account và chưa có order
Tier promotion → customer thuộc đúng tier
Loyalty promotion → customer vẫn còn đủ points
```

Mỗi core hook chỉ được đăng ký một lần. Hãy gộp logic feature vào cùng handler, không để mỗi feature tự gọi `.hooks.validate(...)`.

## 6. Module Link và module isolation

Không thêm `tier_id` trực tiếp vào Customer model.

```text
Customer Module  ↔  Tier Module
Tier Module      ↔  Promotion Module
```

Sau đó Query Graph có thể đọc:

```ts
fields: ["id", "tier.*"]
```

Điều này giữ module độc lập và dễ tái sử dụng.

## 7. Conversion hai chiều phải tách hàm

Policy Loyalty:

```text
10.000 VND spend = 1 point
100 points = 20.000 VND discount
```

Không dùng một hàm mơ hồ cho cả hai chiều. Nên tách:

```ts
calculatePointsFromAmount(amountVnd)
calculateDiscountAmountFromPoints(points)
calculatePointsFromDiscountAmount(discountVnd)
```

Điều này ngăn lỗi truyền `points` vào hàm vốn nhận `amountVnd`.

## 8. Idempotency và locking

Risk:

```text
order.placed retry
  → earn points hai lần
  → deduct points hai lần
```

Ba lớp bảo vệ:

```text
acquireLockStep("loyalty-order-" + order_id)
→ chặn concurrency

promotion.status = inactive
→ loyalty promotion chỉ dùng một lần

order.metadata.loyalty_processed = true
→ retry sau đó skip
```

Khi cần audit/refund, nâng cấp bằng `loyalty_transaction` ledger có unique index:

```text
unique(order_id, type)
```

## 9. Tư duy state machine

Customer Tier:

```text
No tier → Bronze → Silver → Gold
```

First Purchase:

```text
No order → eligible
Has order → ineligible
```

Loyalty:

```text
No points → earn → apply loyalty promo
→ complete order → deduct → promotion inactive
```

Khi code feature, luôn hỏi:

```text
State hiện tại là gì?
Event nào tạo transition?
Rule nào cấm transition?
Retry/concurrency xử lý thế nào?
```

## 10. Thứ tự học đề xuất

1. First-Purchase Discount: workflow, subscriber, hook, static promotion.
2. Customer Tier: custom module, module link, Query Graph, Admin Route.
3. Loyalty System: dynamic promotion, cart metadata, compensation, locking, idempotency.

Sau ba guide này, bạn có nền tảng để xây referral, voucher engine, B2B pricing, membership, campaign reward, cashback và point expiration.
