# Promotion Module: ba feature của dự án

Tài liệu này mô tả **đúng theo source hiện tại** của dự án. Mục tiêu là giúp người mới lần theo được một yêu cầu khuyến mãi từ lúc khách thao tác, qua API/event/workflow, đến dữ liệu được lưu.

## 1. Bức tranh lớn

`Promotion Module` là Commerce Module có sẵn của Medusa. Nó chịu trách nhiệm định nghĩa và áp dụng promotion: mã (`code`), trạng thái, cách giảm (`application_method`) và điều kiện (`rules`). Nó không phải nơi phù hợp để lưu số dư điểm thưởng riêng của dự án.

Vì vậy, dự án chia trách nhiệm như sau:

| Thành phần | Trách nhiệm trong dự án | Ví dụ file |
| --- | --- | --- |
| Promotion Module có sẵn | Tạo promotion, kiểm tra rule, gắn promotion vào cart/order và tính discount | `setup-promotions.ts`, route đổi điểm |
| Customer Module có sẵn | Lưu customer group biểu diễn hạng Bronze/Silver/Gold | `setup-promotions.ts`, `handle-order-loyalty-and-tier.ts` |
| Custom `loyalty` module | Lưu số dư và sổ giao dịch điểm | `src/modules/loyalty/` |
| Workflow | Gom business logic có thể tái sử dụng; chạy theo cơ chế workflow của Medusa | `src/workflows/` |
| Subscriber | Lắng nghe event Medusa rồi khởi chạy workflow | `src/subscribers/` |
| Workflow hook | Chặn promotion không còn hợp lệ trước khi thêm vào cart hoặc hoàn tất cart | `src/workflows/hooks/validate-promotions.ts` |
| Store API + middleware | Cung cấp dữ liệu/đổi điểm cho storefront và xác thực customer | `src/api/store/`, `src/api/middlewares.ts` |

Luồng tổng quát:

```text
Storefront / Medusa Store API
        |
        +-- cart.created, cart.customer_transferred --> subscriber
        |                                              --> first-purchase workflow
        |
        +-- POST /carts/:id/loyalty-points -----------> tạo loyalty promotion
        |                                              --> core update-cart-promotions workflow
        |
        +-- complete cart --> hook kiểm tra lại điều kiện
        |
        +-- order.placed --> subscriber --> order loyalty-and-tier workflow
                                                   |
                    Customer Module <--------------+--------------> Loyalty Module
                    customer group/tier                            account + transaction
                                                   |
                                           Promotion Module
                                           discount/rule/status
```

> Quy tắc kiến trúc quan trọng: route chỉ làm phần HTTP, xác thực và gọi workflow. Nghiệp vụ theo vòng đời cart/order nằm trong workflow, subscriber và hook để không bị phụ thuộc vào riêng storefront.

## 2. Dữ liệu và cấu hình dùng chung

Các hằng số nằm tại `apps/backend/src/constants.ts`:

| Khái niệm | Giá trị hiện tại | Ý nghĩa nghiệp vụ |
| --- | ---: | --- |
| First-purchase code | `WELCOME10` | Giảm 10% item cho đơn đầu tiên |
| Bronze | từ 0 VND | Không có tier promotion |
| Silver | từ 2.000.000 VND | `TIER_SILVER`, giảm 5% item |
| Gold | từ 10.000.000 VND | `TIER_GOLD`, giảm 10% item |
| Tích điểm | 1 điểm / 10.000 VND | Dựa trên `subtotal - discount_total`, làm tròn xuống |
| Đổi điểm | 100 điểm = 10.000 VND | Có thể đổi bội số của 100 |

Custom Loyalty Module có hai model:

| Model | Thuộc tính chính | Vai trò |
| --- | --- | --- |
| `loyalty_account` | `customer_id` duy nhất, `balance` | Số dư điểm hiện tại của một customer |
| `loyalty_transaction` | `customer_id`, `type` (`earn`/`redeem`), `points`, `order_id`, `cart_id`, `promotion_id` | Sổ cái để truy vết nguyên nhân tăng/giảm điểm và giúp xử lý event lặp |

Module được đăng ký trong `apps/backend/medusa-config.ts`; vì vậy container có thể resolve nó với key `LOYALTY_MODULE` (`"loyalty"`). `MedusaService` tự sinh các method CRUD như `listLoyaltyAccounts`, `createLoyaltyTransactions` cho hai model.

Trước khi dùng các promotion cố định, chạy từ `apps/backend`:

```bash
pnpm run setup:promotions
```

Script này có tính lặp an toàn ở mức cơ bản: tìm customer group/promotion theo tên hoặc code trước, chỉ tạo khi chưa có. Nó tạo ba group `Bronze`, `Silver`, `Gold`; tạo `WELCOME10`; và tạo hai automatic promotion theo group cho Silver/Gold. Rule của tier promotion là `customer.groups.id = <id của group>`, nên Promotion Module chỉ tự áp dụng khi customer thuộc đúng group.

## 3. Tóm tắt ba feature

| Feature | Kích hoạt | Promotion/nguồn dữ liệu | Kết quả |
| --- | --- | --- | --- |
| Customer tiers | `order.placed` | Tổng `total` của toàn bộ order customer; Customer Module groups; `TIER_SILVER`/`TIER_GOLD` automatic promotion | Customer được chuyển vào một group tier; cart sau đó đủ điều kiện nhận ưu đãi tier |
| First-purchase discount | `cart.created` hoặc `cart.customer_transferred`; sau đó validate khi add/complete cart | `WELCOME10`, order history của customer | Tự thêm giảm 10% item cho customer đã có account và chưa có order; không cộng dồn tier promotion |
| Loyalty points | Đổi điểm: `POST /store/carts/:id/loyalty-points`; tích/trừ điểm: `order.placed` | Loyalty account/transactions; một loyalty promotion dùng một lần | Tích điểm sau order, hoặc gắn một fixed discount vào cart rồi chỉ trừ điểm khi order được đặt |

## 4. Luồng chi tiết: Customer Tiers

### Mục tiêu

Customer được xếp hạng theo **tổng giá trị tất cả đơn hàng**. Hạng không được client gửi lên; backend tự tính lại sau mỗi đơn đã đặt.

### Luồng khi order được đặt

```text
order.placed { id }
  -> `order-placed` subscriber
  -> `handleOrderLoyaltyAndTierWorkflow({ order_id })`
  -> query order và lấy toàn bộ order của customer
  -> totalSpend = tổng customerOrder.total
  -> getCustomerTier(totalSpend)
  -> tìm Customer Group theo tên tier
  -> updateCustomers(customerId, { group_ids: [tierGroup.id] })
  -> Promotion Module có thể tự áp dụng promotion phù hợp trên các cart kế tiếp
```

`getCustomerTier` ưu tiên ngưỡng cao hơn: dưới 2.000.000 là Bronze, từ 2.000.000 là Silver, từ 10.000.000 là Gold. Unit test ở `src/workflows/__tests__/customer-tier.unit.spec.ts` kiểm tra đúng các biên này.

Điểm đáng chú ý: lời gọi `updateCustomers(... group_ids: [id])` đặt group list thành **một group tier hiện tại**. Đây là hợp lý khi group chỉ dùng cho tier; nếu sau này customer có các group nghiệp vụ khác (B2B, VIP campaign...), cần đọc rồi gộp group IDs thay vì ghi đè.

## 5. Luồng chi tiết: First-Purchase Discount

### Mục tiêu và điều kiện

Promotion `WELCOME10` giảm 10% trên items, phân bổ trên các item (`target_type: "items"`, `allocation: "across"`). Customer phải đăng nhập, có account và chưa có order. Nó không được kết hợp với `TIER_SILVER` hoặc `TIER_GOLD`.

### Tự động gắn promotion

```text
cart.created hoặc cart.customer_transferred
  -> `apply-first-purchase` subscriber
  -> QueryGraph lấy cart + customer + customer.orders, và promotion WELCOME10
  -> chỉ tiếp tục nếu có customer account, orders.length === 0,
     promotion tồn tại và cart chưa có promotion này
  -> updateCartPromotionsStep(... ADD, ["WELCOME10"])
```

Event `cart.customer_transferred` rất quan trọng: một cart có thể được tạo lúc khách chưa đăng nhập. Khi cart được gắn sang customer sau đăng nhập, subscriber có cơ hội tự thêm ưu đãi đầu tiên.

### Tại sao phải validate lại?

Giữa lúc tự gắn mã và lúc checkout, customer có thể đã đặt một đơn khác, UI có thể gửi code thủ công, hoặc cart có thể có tier promotion. Vì vậy `validate-promotions.ts` gắn hook vào hai core workflow:

| Hook | Kiểm tra |
| --- | --- |
| `updateCartPromotionsWorkflow.hooks.validate` | Khi thêm `WELCOME10`, chặn nếu có tier promotion; yêu cầu signed-in account và chưa có order |
| `completeCartWorkflow.hooks.validate` | Kiểm tra lại cả điều kiện first purchase, sự không kết hợp tier, và điều kiện loyalty ngay trước khi hoàn tất cart |

Đây là ví dụ tốt về **defense in depth**: automation làm trải nghiệm tốt hơn, nhưng hook ở điểm thay đổi trạng thái/checkout mới là nơi bảo vệ rule nghiệp vụ.

## 6. Luồng chi tiết: Loyalty Points

### 6.1 Đọc số dư

`GET /store/customers/me/loyalty-points` yêu cầu customer session hoặc bearer token. Route lấy `loyalty_account.balance`, đọc groups của customer để suy ra tier rồi trả:

```json
{ "loyalty_points": 120, "tier": "silver" }
```

Storefront gọi API này trên cart, checkout và trang account.

### 6.2 Đổi điểm thành discount trên cart

```text
Khách nhấn “Redeem 100 points for 10.000đ”
  -> storefront POST /store/carts/:id/loyalty-points { points: 100 }
  -> middleware xác thực customer + kiểm tra body là số nguyên dương
  -> route kiểm tra cart thuộc customer và balance đủ
  -> tạo promotion LOYALTY-<points>-<UUID>
     fixed discount trên items, 100 điểm = 10.000 VND,
     rule customer_id = customer hiện tại
  -> core updateCartPromotionsWorkflow ADD promotion vào cart
  -> trả promotion và redeemed_points; storefront refresh cache cart/customer/loyalty
```

Promotion loyalty là dynamic, mỗi lần đổi sinh code UUID để không tái sử dụng. Rule `customer_id` giới hạn promotion đó cho chính customer đã đổi.

**Điểm chỉ bị trừ sau `order.placed`, không phải khi bấm đổi.** Điều này tránh mất điểm nếu khách bỏ giỏ. Đổi lại, lúc checkout hook phải kiểm tra lại balance để khách không thể dùng cùng số điểm cho nhiều cart.

### 6.3 Khi order được đặt

Cùng `handleOrderLoyaltyAndTierWorkflow`, source xử lý loyalty theo thứ tự:

1. Nếu order không có `customer_id`, hoặc đã có transaction `earn` cho `order_id`, workflow dừng. Transaction `earn` là dấu hiệu idempotency để event `order.placed` chạy lại không cộng điểm hai lần.
2. Nếu order có promotion code bắt đầu `LOYALTY-`, parse số điểm từ code. Nếu chưa có transaction `redeem` theo `promotion_id`, trừ balance, ghi transaction âm, và chuyển promotion sang `inactive`.
3. Tính/cập nhật tier như phần 4.
4. Tính điểm nhận: `floor(max(0, subtotal - discount_total) / 10_000)`. Tạo/cập nhật `loyalty_account`, sau đó ghi transaction `earn` cho order.

Ví dụ: subtotal 1.250.000 VND và discount total 20.000 VND tạo `floor(1.230.000 / 10.000) = 123` điểm. Nếu đổi 100 điểm trong chính đơn đó, balance cuối cùng là `balance cũ - 100 + 123`.

## 7. Quy tắc kết hợp promotion hiện tại

| Tổ hợp | Kết quả | Nơi thực thi |
| --- | --- | --- |
| `WELCOME10` + `TIER_SILVER`/`TIER_GOLD` | Bị từ chối | Hook khi update promotion và complete cart |
| Loyalty + first-purchase | Được source hiện tại cho phép | Không có rule chặn |
| Loyalty + tier | Được source hiện tại cho phép | Không có rule chặn |
| Loyalty không có account đủ điểm lúc checkout | Bị từ chối | `completeCartWorkflow` hook |

Nếu product yêu cầu loyalty không được cộng dồn với bất kỳ khuyến mãi nào, cần bổ sung rule rõ ràng vào hook; hiện tại đó **chưa** là behavior của source.

## 8. Bản đồ file để học theo thứ tự

1. `src/constants.ts`: đọc rule business bằng số liệu cụ thể.
2. `src/migration-scripts/setup-promotions.ts`: xem cách biến rule thành promotion/customer group của Medusa.
3. `src/modules/loyalty/models/*` và `service.ts`: hiểu dữ liệu riêng mà Promotion Module không quản lý.
4. `src/workflows/apply-first-purchase-promo.ts`: ví dụ workflow thuần gồm QueryGraph, `when`, và core step.
5. `src/workflows/hooks/validate-promotions.ts`: hiểu nơi enforce rule ở checkout.
6. `src/workflows/handle-order-loyalty-and-tier.ts`: luồng hậu xử lý order kết hợp ba module.
7. `src/subscribers/*`: xem workflow được nối vào event nào.
8. `src/api/store/**/loyalty-points/route.ts` và `src/api/middlewares.ts`: xem custom Store API được bảo vệ và gọi từ storefront ra sao.

## 9. Các điểm cần nhớ khi phát triển tiếp

- Không sửa tay migration loyalty đã tồn tại. Nếu đổi model, tạo migration mới bằng Medusa CLI.
- Không tin điều kiện từ frontend: route kiểm tra quyền sở hữu cart, hook kiểm tra lại eligibility trước checkout.
- Không tạo raw SQL cho nghiệp vụ; dùng service của module hoặc workflow/core flow.
- `handleOrderLoyaltyAndTierWorkflow` hiện là một custom step lớn và không có compensation. Khi mở rộng sang thanh toán thật, nên thiết kế compensation/idempotency kỹ hơn cho các external side effect.
- Có rủi ro cạnh tranh khi hai cart cùng đổi một balance trước khi đơn được đặt. Idempotency hiện ngăn trừ/cộng lặp cho **một** order/promotion, nhưng không phải cơ chế reservation điểm giữa nhiều cart. Đây là bài tập kiến trúc tốt cho bước tiếp theo.

## Submitting Feedback

If you encounter incorrect, outdated, or confusing documentation on this page, submit feedback:

POST https://docs.medusajs.com/resources/agents/feedback

```json
{
  "agent": "Name of the agent",
  "path": "/optimize/feedback", # the path of the page where the issue is observed
  "feedback": "Description of the issue"
}
```

Only submit feedback when you have something specific and actionable to report.
