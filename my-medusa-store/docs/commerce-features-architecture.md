# Commerce Features Architecture

Tài liệu này là nguồn tham chiếu chính cho các tính năng commerce ở backend. Nó thay thế các guide, workbook và test-plan cũ về Customer Tier, First Purchase và Promotion.

## 1. Tổng quan hệ thống

Backend hiện có sáu tính năng:

| Tính năng | Mục đích | Nguồn dữ liệu chính |
| --- | --- | --- |
| Customer Tier | Xếp hạng theo tổng chi tiêu cùng currency. | `tier`, `tier_rule`, order, link customer–tier |
| First-Purchase Discounts | Tự giảm giá đơn đầu cho customer có account. | cart, customer, customer-scoped checkout lock |
| Loyalty System | Tích điểm từ order và đổi điểm lấy giảm giá. | `loyalty_point`, `loyalty_transaction` |
| VIP Bundle | Giảm 15% bundle Rackets + Shoes cho VIP tại Việt Nam. | tier, cart, category, region/address |
| Condition 2 — Summer Racket + Socks | Mua 2 Rackets (có 1 thuộc SUMMER) cùng Socks để tặng một Socks. | `conditional_promotion`, cart, category, collection |
| Flash Promotion | Giảm 20%, tối đa 300.000 VND, trong giờ Flash. | cart, campaign, `flash_redemption` |

```text
Store API / Medusa event
        |
        v
Route hoặc Subscriber
        |
        v
Workflow (điều phối, lock, compensation)
        |
        +--> Core flow / workflow step (đọc, ghi Cart/Order/Promotion)
        |
        +--> Custom step
                 |
                 v
           Module service (nghiệp vụ + transaction state)
                 |
                 v
           Custom models / Medusa core models
```

Nguyên tắc: route và subscriber không tự tính nghiệp vụ. Route xác thực HTTP rồi chạy workflow; subscriber phản ứng với event; workflow gọi step; step resolve service/model từ container.

## 2. Luồng chung của promotion

```text
Cart được tạo / customer đăng nhập / cart thay đổi
        |
        +--> apply-first-purchase subscriber
        |       --> applyFirstPurchasePromoWorkflow
        |
        +--> cart-updated subscriber
                --> refreshConditionalPromotionsWorkflow
                        --> chọn VIP Bundle / Buy-get / Flash tốt nhất
                        --> thay promotion trên cart

Customer checkout
        |
        v
completeCartWorkflow.hooks.validate
        --> kiểm tra lại tier, first-order, điểm và điều kiện promotion
        --> từ chối cart stale hoặc promotion bị thêm thủ công
        |
        v
Order đặt thành công: `order.placed`
        --> cập nhật tier
        --> consume first purchase
        --> xử lý loyalty
        --> consume Flash redemption
```

`complete-cart-validate.ts` là hàng rào cuối: automation có thể thêm promotion để cải thiện UX, nhưng không được thay thế validation khi thanh toán.

## Inventory theo feature: workflow, API và event

Phần này là danh mục thực thi. Một feature có thể có nhiều workflow cho các nhánh quản trị, cart và order; không nên chỉ nhìn một workflow rồi coi đó là toàn bộ feature.

### Customer Tier

```text
ADMIN MANAGEMENT
POST /admin/tiers              --> createTierWorkflow
POST /admin/tiers/:id          --> updateTierWorkflow
GET  /admin/tiers, /:id, /:id/customers --> Query Graph (read-only)

CUSTOMER LIFECYCLE
order.placed --> updateCustomerTierOnOrderWorkflow
cart.updated --> addTierPromotionToCartWorkflow
GET /store/customers/me/next-tier --> TierModuleService.calculateNextTierUpgrade

`refresh-promotions` subscriber hiện chạy cả conditional-promotion workflow và
`addTierPromotionToCartWorkflow`. Nếu business policy là "một promotion", workflow
điều phối phải quyết định rõ promotion tier có được giữ cùng conditional promotion hay không.
```

| Nhánh | Workflow / API | Vai trò |
| --- | --- | --- |
| Tạo tier | `createTierWorkflow` | Tạo `Tier`, các `TierRule` và kiểm tra promotion chưa thuộc tier khác. |
| Sửa tier | `updateTierWorkflow` | Cập nhật tên/promotion, thay rule cũ bằng rule input mới. |
| Xem tier | `GET /admin/tiers`, `GET /admin/tiers/:id` | Query Graph trả tier/rules/promotion theo fields và pagination. |
| Xem members | `GET /admin/tiers/:id/customers` | Query index customer được link với tier. |
| Tính tier sau order | `updateCustomerTierOnOrderWorkflow` | Tổng order hợp lệ theo currency, gọi `determineTierStep`, thay link customer–tier. |
| Tự gắn promo tier | `addTierPromotionToCartWorkflow` | Đọc `customer.tier.promo_id`, gọi `validateTierPromotionStep`, ADD promotion nếu active. |
| Xem tiến độ | `GET /store/customers/me/next-tier?region_id=...` | Tổng spend ở region, gọi `calculateNextTierUpgrade`. |

**Steps và service:** `createTierStep` tạo tier; `createTierRulesStep` tạo rule; `deleteTierRulesStep` xóa rule cũ khi update; `validateTierPromotionOwnershipStep` tránh một promotion bị hai tier sở hữu; `validateCustomerStep` yêu cầu customer hợp lệ; `determineTierStep` gọi `TierModuleService.calculateQualifyingTier`.

### First-Purchase Discounts

```text
cart.created / cart.customer_transferred
  --> applyFirstPurchasePromoWorkflow
  --> updateCartPromotionsStep

POST /store/carts/:id/complete-customer-promotion
  --> completeCustomerPromotionCartWorkflow
  --> acquire customer lock
  --> completeCartWorkflow.runAsStep
  --> completeCartWorkflow.hooks.validate
  --> release customer lock

`POST /store/carts/:id/complete-customer-promotion` là checkout endpoint cho cart
có `FIRST_PURCHASE` hoặc Loyalty promotion; nó khóa customer xuyên suốt checkout.
```

| Workflow / hook | Vai trò |
| --- | --- |
| `applyFirstPurchasePromoWorkflow` | Chỉ ADD `FIRST_PURCHASE` cho customer có account, chưa có order và promotion active. |
| `completeCustomerPromotionCartWorkflow` | Khóa `customer-promotion-<customer_id>` và `cart_id`, sau đó chạy core completion workflow nested. |
| `POST /store/carts/:id/complete-customer-promotion` | API mỏng chạy wrapper workflow và trả order hoàn tất. |
| `updateCartPromotionsWorkflow.hooks.validate` | Chặn client thêm code khi customer chưa có account hoặc đã có order. |
| `completeCartWorkflow.hooks.validate` | Query lại `customer.orders`; nếu order đã tồn tại thì chặn checkout. |

### Loyalty System

```text
GET  /store/customers/me/loyalty-points --> LoyaltyModuleService.getPoints
POST /store/carts/:id/loyalty-points   --> applyLoyaltyOnCartWorkflow
DELETE /store/carts/:id/loyalty-points --> removeLoyaltyFromCartWorkflow
order.placed                            --> handleOrderPointsWorkflow
```

| Nhánh | Workflow / API | Vai trò |
| --- | --- | --- |
| Đọc balance | `GET /store/customers/me/loyalty-points` | Trả balance của customer đã auth. |
| Đổi điểm | `POST /store/carts/:id/loyalty-points` | `assertCartOwnership`, validate point block, rồi chạy apply workflow. |
| Bỏ đổi điểm | `DELETE /store/carts/:id/loyalty-points` | Ownership check, remove/inactive dynamic promo; không thay đổi balance. |
| Apply vào cart | `applyLoyaltyOnCartWorkflow` | Lock cart, tính discount, tạo promotion one-time, ADD vào cart; không trừ point. |
| Checkout loyalty | `completeCustomerPromotionCartWorkflow` | Lock customer/cart, trừ point và ghi redemption ledger; compensation hoàn point nếu checkout fail. |
| Xử lý order | `handleOrderPointsWorkflow` | Finalize redemption audit, inactive promotion và earn points idempotently. |

**Steps và service:** `validateCustomerExistsStep` yêu cầu login; `getCartLoyaltyPromoStep` chống hai loyalty promotion; `getCartLoyaltyPromoAmountStep` đổi point sang VND; `consumeLoyaltyPointsForCheckoutStep` trừ point trong customer lock; `processOrderLoyaltyStep` finalize audit và earn; `LoyaltyModuleService.recordTransaction` là lớp idempotency cho earn theo `type + reference_id`.

### VIP Bundle, Condition 2 và Flash Promotion

Ba feature này dùng **một workflow orchestration chung**, không phải ba route riêng. Lý do: chúng cần so giá trị discount để chỉ giữ một promotion trên cart.

```text
cart.updated
  --> refreshConditionalPromotionsWorkflow
  --> refreshConditionalPromotionsStep
        --> evaluate VIP Bundle
        --> evaluate Condition 2 từ rule-tree cấu hình
        --> evaluate Flash
        --> chọn candidate tốt nhất
        --> REPLACE promotions trên cart

complete cart --> validateConditionalPromotions
order.placed   --> consumeFlashRedemption (chỉ Flash)
```

| Feature | Workflow / API | Vai trò |
| --- | --- | --- |
| VIP Bundle | `refreshConditionalPromotionsWorkflow` | Đủ VIP, VN, subtotal, 2 Rackets + 1 Shoes thì candidate `VIP_BUNDLE_15`. Không có public API riêng. |
| Condition 2 — Summer Racket + Socks | `refreshConditionalPromotionsWorkflow` + `conditional-promotion` module | Đủ 2 Rackets, trong đó 1 thuộc collection `summer`, và có Socks thì candidate `RACKET_SUMMER_GET_SOCK`. Admin CRUD quản lý rule/copy/placement; Store endpoint chỉ trả copy và placement đã lọc. |
| Flash | `claimFlashSaleWorkflow` | Customer chủ động claim source code public trong schedule; không auto-apply từ `cart.updated`. |
| Flash quota | `PromotionEntitlementModuleService.reserveFlashRedemption` | Reserve lượt 1/2 cho cart; từ chối lượt thứ ba. |
| Flash consume | `orderPlacedHandler` | Khi cart có code Flash, gọi `consumeFlashRedemption(cart_id, order_id)`. |
| Checkout gate | `validateConditionalPromotions` | Re-evaluate mọi condition và chặn code stale/manually attached. |

`refreshConditionalPromotionsStep` là nơi có các helper `quantityFor`, `eligibleItems`, `isFlashWindow`, `calculateVipDiscount`, `calculateBuyGetDiscount`. Nó chỉ đọc/calculate; các ghi thay đổi state được thực hiện qua `updateCartPromotionsWorkflow`, Promotion Module và entitlement service.

## 3. Customer Tier

Customer có đúng một tier thông qua module link `tier ↔ customer`. Rule của mỗi tier có `min_purchase_value` theo currency. Các tier seed gồm Bronze, Silver, Gold và VIP; VIP bắt đầu từ 20.000.000 VND.

```text
order.placed
  --> orderPlacedHandler
  --> updateCustomerTierOnOrderWorkflow(order_id)
        --> Query order và các order hợp lệ cùng currency
        --> validateCustomerStep
        --> determineTierStep
              --> TierModuleService.calculateQualifyingTier
        --> dismissRemoteLinkStep (nếu tier cũ khác)
        --> createRemoteLinkStep (gắn tier mới)
```

| Thành phần | Vai trò |
| --- | --- |
| `src/modules/tier/models/tier.ts` — `Tier` | Lưu tên tier và `promo_id` tùy chọn. |
| `src/modules/tier/models/tier-rule.ts` — `TierRule` | Lưu ngưỡng chi tiêu theo currency. |
| `src/modules/tier/service.ts` — `calculateQualifyingTier` | Chọn rule cao nhất mà tổng chi tiêu đạt được. |
| `TierModuleService.calculateNextTierUpgrade` | Trả tier kế tiếp và số tiền còn thiếu cho API/storefront. |
| `src/workflows/customer-tier/update-customer-tier-on-order/index.ts` | Điều phối query order, tính tổng và thay module link. |
| `src/workflows/steps/determine-tier.ts` | Adapter workflow gọi `TierModuleService`. |
| `src/api/admin/tiers/**` | API quản trị CRUD tier/rule. |
| `src/api/store/customers/me/next-tier/route.ts` | API đọc tiến độ tier của customer hiện tại. |

## 4. First-Purchase Discounts

Promotion cố định là `FIRST_PURCHASE`. Chỉ customer đã có account và chưa có order mới được dùng. Không dùng entitlement; race condition được chặn bằng customer-scoped lock bao quanh toàn bộ checkout.

```text
cart.created / cart.customer_transferred
  --> cartCreatedHandler
  --> applyFirstPurchasePromoWorkflow
        --> updateCartPromotionsStep(ADD FIRST_PURCHASE)

POST /store/carts/:id/complete-customer-promotion
  --> completeCustomerPromotionCartWorkflow
        --> acquireLockStep(customer-promotion-<customer_id>)
        --> acquireLockStep(<cart_id>)
        --> completeCartWorkflow.runAsStep
              --> validate first-purchase bằng customer.orders mới nhất
        --> release hai lock sau khi core workflow hoàn tất
```

| Thành phần | Vai trò |
| --- | --- |
| `apply-first-purchase-promo/index.ts` | Tự thêm code sau khi kiểm tra account và lịch sử order. |
| `promotions/complete-customer-promotion-cart/index.ts` | Wrapper lock customer/cart và gọi core complete-cart workflow. |
| `api/store/carts/[id]/complete-customer-promotion/route.ts` | Endpoint checkout dùng cho First Purchase và Loyalty. |
| `workflows/hooks/update-cart-promotion-validate.ts` | Chặn add `FIRST_PURCHASE` không hợp lệ. |
| `workflows/hooks/complete-cart-validate.ts` | Query lại lịch sử order ngay trước checkout. |

## 5. Loyalty System

Chính sách hiện tại: mỗi 10.000 VND tạo 1 point; 100 point đổi được 20.000 VND. Điểm chỉ tăng/giảm theo ledger để event retry không làm thay đổi balance hai lần.

```text
POST /store/carts/:id/loyalty-points
  --> assertCartOwnership
  --> applyLoyaltyOnCartWorkflow(cart_id, points)
        --> validateCustomerExistsStep
        --> getCartLoyaltyPromoStep
        --> acquireLockStep(cart)
        --> getCartLoyaltyPromoAmountStep
        --> createPromotionsStep (dynamic, one-time code)
        --> updateCartPromotionsWorkflow

POST /store/carts/:id/complete-customer-promotion
  --> customer + cart lock
  --> consumeLoyaltyPointsForCheckoutStep
  --> completeCartWorkflow.runAsStep
  --> compensation hoàn điểm nếu checkout fail

order.placed
  --> handleOrderPointsWorkflow
        --> acquireLockStep(customer)
        --> processOrderLoyaltyStep
              --> ghi earn/redeem transaction và cập nhật balance
```

| Thành phần | Vai trò |
| --- | --- |
| `api/store/carts/[id]/loyalty-points/route.ts` — `POST` | Đổi điểm thành promotion cho cart thuộc customer hiện tại. |
| `DELETE` cùng route | Bỏ/inactive promotion loyalty, không thay đổi balance. |
| `LoyaltyPoint` | Balance hiện tại, duy nhất theo customer. |
| `LoyaltyTransaction` | Ledger earn, redemption consumed/reversed; có unique reference. |
| `LoyaltyModuleService.addPoints` / `deductPoints` | Cập nhật balance. |
| `recordTransaction` | Idempotent theo `type + reference_id`, sau đó áp dụng points. |
| `calculatePointsFromAmount` | Quy đổi tiền chi tiêu sang điểm. |
| `calculateDiscountAmountFromPoints` | Quy đổi point hợp lệ sang tiền giảm. |
| `apply-loyalty-on-cart/index.ts` | Tạo dynamic promotion dưới cart lock, không trừ điểm. |
| `complete-customer-promotion-cart/steps/consume-loyalty-points.ts` | Trừ point trong checkout và compensation khi core checkout fail. |
| `handle-order-points/index.ts` | Finalize audit/earn sau order, dùng customer lock chung. |

## 6. Conditional badminton promotions

Ba promotion này dùng category thực tế của catalog:

```text
VIP Bundle:       2 Rackets + 1 Shoes  --> giảm 15% tối đa 3 đơn vị
Buy Racket Get:   2 Rackets, có 1 SUMMER + Socks trong cart --> tặng 1 Socks
Flash:            cart của customer đăng nhập, 18:00–22:00 ICT --> giảm 20%, cap 300.000 VND
```

Khi nhiều rule cùng đúng, workflow chọn duy nhất promotion có discount cao nhất. Nếu bằng nhau, ưu tiên Buy-get, rồi VIP Bundle, rồi Flash. Do đó các promotion mới không cộng dồn với nhau hoặc với code còn lại trên cart.

```text
cart.updated
  --> cartUpdatedHandler
  --> refreshConditionalPromotionsWorkflow(cart_id)
        --> refreshConditionalPromotionsStep
              --> Query cart, tier, region, address, items, category, collection
              --> tính các candidate và giá trị giảm
              --> chọn candidate thắng
              --> Flash: tạo/cập nhật promotion fixed riêng của cart
              --> Flash: reserveFlashRedemption
              --> updateCartPromotionsWorkflow(REPLACE)

checkout
  --> validateConditionalPromotions
        --> xác nhận đầy đủ rule của code đang gắn
        --> xác nhận một promotion duy nhất
        --> xác nhận Flash reservation và giờ hợp lệ

order.placed
  --> orderPlacedHandler
  --> PromotionEntitlementModuleService.consumeFlashRedemption
```

### VIP Bundle

Điều kiện: customer thuộc tier `VIP`; Vietnam region và địa chỉ `VN` nếu đã có; subtotal hàng trước giảm ít nhất 2.000.000 VND; ít nhất 2 `Rackets` và 1 `Shoes`.

Promotion `VIP_BUNDLE_15` là standard promotion 15%, target `Rackets` và `Shoes`, `allocation: once`, `max_quantity: 3`. Engine chọn ba đơn vị rẻ nhất trong target.

### Condition 2 — Buy Racket Get Sock

**Mô tả:** Cart có ít nhất 2 `Rackets`, trong đó ít nhất 1 Racket thuộc collection `summer`, và có ít nhất 1 `Socks`. `RACKET_SUMMER_GET_SOCK` giảm 100% tối đa một Socks; khách không cần đăng nhập.

**Quyết định kiến trúc:** Đây là `standard` promotion carrier, không dùng native `buyget`. Eligibility là rule-tree do module `conditional-promotion` lưu và workflow evaluate; carrier chỉ thể hiện target Socks, `allocation: once` và `max_quantity: 1`. Rule v1 dùng `AND` giữa Quantity Condition, với matcher `ALL`/`ANY` cho Product, Category, Collection, Tag và Type. Subset requirement luôn evaluate trong tập item match điều kiện cha.

**Lifecycle và cạnh tranh:** `cart.updated` chạy `refreshConditionalPromotionsWorkflow`; workflow tính giá trị benefit của tất cả candidate và chỉ giữ candidate lớn nhất. Nếu bằng nhau, Condition 2 ưu tiên hơn VIP Bundle và Flash. `completeCartWorkflow.hooks.validate` đánh giá lại rule của promotion đã gắn và từ chối cart stale hoặc promotion được gắn thủ công. Condition 2 không stack với VIP Bundle hoặc Flash.

**Tiến độ:** module/model/migration, seed idempotent, workflow refresh, checkout validation, Admin CRUD/UI, Store catalogue endpoint và metadata hiển thị storefront đã được thêm. Chưa có bằng chứng kiểm thử tự động đã chạy cho evaluator, refresh và checkout revalidation; đây là hạng mục còn lại trước khi phát hành.

### Flash Promotion

Flash dùng một source code public, ví dụ `FLASH20_DAILY`, và custom line-item adjustment có giá trị `min(subtotal × 20%, 300.000)`. Admin chọn một native Campaign budget: `spend` hoặc `usage`; Promotion Module consume qua `registerUsageStep`. Reservation giữ quota/customer, expiry/audit. Mã đã add vào cart vẫn checkout được nếu Campaign budget đạt giới hạn sau đó.

Flash cần customer đăng nhập vì rule quota cần `customer_id`. Mỗi lượt reservation/consumption được lưu riêng; tổng reservation hoặc consumption của customer không vượt 2.

| Thành phần | Vai trò |
| --- | --- |
| `migration-scripts/seed/categories.ts` | Định nghĩa catalog categories và handle `summer`. |
| `migration-scripts/seed/products.ts` | Tạo SUMMER collection, gán ba Racket Yonex. |
| `modules/conditional-promotion/**` | Lưu rule-tree, target, copy, placement và trạng thái của Condition 2. |
| `scripts/seed-promotions.ts` | Seed VIP Bundle, Condition 2 và campaign placeholder Flash idempotently. |
| `workflows/promotions/refresh-conditional-promotions/index.ts` — `refreshConditionalPromotionsWorkflow` | Entry point workflow khi cart thay đổi. |
| `refreshConditionalPromotionsStep` | Query cart, tính eligibility/discount, chọn code và thay promotions. |
| `workflows/conditional-promotions/{rules,candidates}.ts` | Evaluate matcher/rule-tree Condition 2 và tính benefit để cạnh tranh với các candidate khác. |
| `quantityFor` / `eligibleItems` | Đếm và lọc line item theo product category. |
| `isFlashWindow` | Kiểm tra 18:00–22:00 trong `Asia/Ho_Chi_Minh`. |
| `calculateVipDiscount` | Tính 15% cho ba target unit rẻ nhất. |
| `customCandidate` | Evaluate rule-tree và tính benefit Socks của Condition 2 để so candidate. |
| `FlashRedemption` | Lưu reservation/consumption Flash, amount, cart/order/customer. |
| `reserveFlashRedemption` | Reserve quota của customer cho cart; chặn lượt thứ ba. |
| `consumeFlashRedemption` | Consume quota khi order đã đặt. |
| `releaseFlashRedemption` | Xóa reservation chưa dùng khi cart mất Flash eligibility. |
| `complete-cart-validate.ts` — `validateConditionalPromotions` | Chống cart stale, mã tự thêm và checkout ngoài khung giờ. |

## 7. Điều hành và triển khai

```bash
cd apps/backend
pnpm exec medusa db:migrate
pnpm run seed:promotions
```

Migration mới tạo bảng `flash_redemption`. `seed:promotions` tạo promotion/campaign nếu chưa tồn tại. `seed:customer-tiers` chỉ dành cho fixture/demo vì nó tạo lại order demo; production quản trị tier qua Admin API/UI.

Khi thêm promotion mới, phải cập nhật đồng thời workflow điều phối cart và validation checkout. Không chỉ thêm promotion trong Admin: nếu không có validation backend, người dùng vẫn có thể gắn code vào cart không đủ điều kiện.
