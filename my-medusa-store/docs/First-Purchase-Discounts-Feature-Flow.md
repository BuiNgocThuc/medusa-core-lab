# First-Purchase Discounts — Feature Flow

## Mục tiêu nghiệp vụ

Customer đã đăng ký được hệ thống tự gắn promotion `FIRST_PURCHASE` vào cart đầu tiên. Customer không phải biết hoặc nhập mã promotion. Promotion chỉ hợp lệ khi entitlement first-purchase đang được reserve cho chính cart đó; sau khi order được tạo, entitlement được consume để không dùng lại.

Promotion fixture được khai báo trong `apps/backend/src/scripts/seed-promotions.ts`. Nó có code `FIRST_PURCHASE`, trạng thái `active` và giảm 10%.

## Tổng quan luồng

## Flow chart dễ đọc

```text
STORE FRONTEND

Guest customer
  |
  | Register hoặc sign in
  v
signup() / sign-in action
  |
  | transferCart(cartId) qua Medusa Store API chuẩn
  v
Cart được gắn customer


MEDUSA SERVER — AUTO-APPLY

cart.customer_transferred event
  |
  | apply-first-purchase subscriber
  v
applyFirstPurchasePromoWorkflow(cart_id)
  |
  |-- Cart có registered customer? ------- No --> Stop, không giảm giá
  |
  |-- FIRST_PURCHASE active? ------------- No --> Stop, không giảm giá
  |
  |-- Cart đã có promotion? -------------- Yes -> Stop, không add trùng
  |
  `-- Yes
        |
        v
reserveFirstPurchaseStep(customer_id, cart_id)
        |
        v
FirstPurchaseEntitlement
available -> reserved cho cart này
        |
        v
updateCartPromotionsStep(ADD, "FIRST_PURCHASE")
        |
        v
Cart có giảm giá 10%


STORE FRONTEND

Customer nhấn Place Order
  |
  v
Medusa completeCartWorkflow


MEDUSA SERVER — FINAL VALIDATION

completeCartWorkflow.validate hook
  |
  |-- Cart có FIRST_PURCHASE? ------------ No --> Medusa xử lý order bình thường
  |
  `-- Yes
        |
        |-- Customer có account? ---------- No --> Throw INVALID_DATA, không tạo order
        |
        |-- Entitlement reserved cho cart? - No --> Throw INVALID_DATA, không tạo order
        |
        `-- Yes
              |
              v
        Medusa tạo order và trả order về storefront
              |
              v
        order.placed event
              |
              v
        consumeFirstPurchaseOnOrderWorkflow(order_id)
              |
              v
        FirstPurchaseEntitlement
        reserved -> consumed
              |
              v
        Customer không còn nhận FIRST_PURCHASE ở cart sau
```

### Phiên bản rút gọn

```text
Storefront register/sign-in
        ↓
Transfer guest cart sang customer
        ↓
Medusa nhận cart.customer_transferred
        ↓
Reserve quyền giảm giá đầu tiên cho cart
        ↓
Tự add FIRST_PURCHASE vào cart
        ↓
Customer Place Order
        ↓
Kiểm tra quyền vẫn thuộc cart này
        ↓
Tạo order
        ↓
Đánh dấu quyền first-purchase đã dùng
```

```text
Storefront register / sign in
  -> transfer guest cart to customer (Store API chuẩn của Medusa)
  -> Medusa emits cart.customer_transferred
  -> apply-first-purchase subscriber
  -> applyFirstPurchasePromoWorkflow
  -> reserve FirstPurchaseEntitlement for cart
  -> programmatically add FIRST_PURCHASE to cart

Storefront completes cart (Store API chuẩn)
  -> completeCartWorkflow.validate hook
  -> validate entitlement belongs to customer + cart
  -> Medusa creates order
  -> Medusa emits order.placed
  -> consumeFirstPurchaseOnOrderWorkflow
  -> entitlement reserved -> consumed
```

Không có custom API route riêng cho First-Purchase Discount. Client gọi Store API chuẩn của Medusa để đăng ký, transfer cart, cập nhật cart và complete cart. Customization bắt đầu từ event subscriber và workflow hook ở backend.

## Client → Medusa event

### 1. Register hoặc sign in

Component `apps/storefront/src/modules/account/components/register/index.tsx` submit form vào server action `signup` trong `apps/storefront/src/lib/data/customer.ts`.

Sau khi customer được authenticate, `signup` gọi `transferCart()` trong cùng file. Hàm này:

1. Lấy cart ID hiện tại bằng `getCartId()`.
2. Lấy auth headers bằng `getAuthHeaders()`.
3. Gọi SDK chuẩn `sdk.store.cart.transferCart(cartId, {}, headers)`.

Medusa chuyển guest cart sang customer và phát event `cart.customer_transferred`. Nếu cart được tạo đã có customer ngay từ đầu, Medusa phát `cart.created`.

### 2. Subscriber bắt event

`apps/backend/src/subscribers/apply-first-purchase.ts` export `cartCreatedHandler` và config:

```ts
event: ["cart.created", "cart.customer_transferred"]
```

Handler gọi:

```ts
applyFirstPurchasePromoWorkflow(container).run({
  input: { cart_id: data.id },
})
```

`data.id` là cart ID từ event. Subscriber không chứa business logic; nó chỉ biến event thành workflow input.

## Auto-apply workflow

Workflow `applyFirstPurchasePromoWorkflow` nằm ở `apps/backend/src/workflows/apply-first-purchase-promo.ts`.

### Query cart và promotion

`useQueryGraphStep` đầu tiên lấy cart cùng `promotions.*` và `customer.*`. Query thứ hai lấy promotion có code từ constant `FIRST_PURCHASE_PROMOTION_CODE` trong `apps/backend/src/constant.ts`.

Workflow chỉ đi tiếp khi:

- promotion tồn tại và `status === "active"`;
- cart chưa có promotion đó;
- cart đã có customer;
- customer có `has_account === true`.

Guest cart không nhận promotion. Đây là lý do event `cart.customer_transferred` quan trọng: guest cart chỉ đủ điều kiện sau login/register.

### Reserve entitlement

Khi đủ điều kiện, workflow gọi step `reserveFirstPurchaseStep` tại `apps/backend/src/workflows/steps/reserve-first-purchase.ts` với `customer_id` và `cart_id`.

Step resolve service bằng registration key `PROMOTION_ENTITLEMENT_MODULE`, rồi gọi:

```ts
entitlementService.reserveFirstPurchase(customer_id, cart_id)
```

Service nằm ở `apps/backend/src/modules/promotion-entitlement/service.ts`.

Business rule của `reserveFirstPurchase`:

| Entitlement hiện có | Kết quả |
| --- | --- |
| Chưa có record | Tạo record `reserved` cho cart hiện tại |
| `available` | Update thành `reserved` cho cart hiện tại |
| `reserved` cùng cart | Idempotent, giữ reservation |
| `reserved` cart khác | Ném `CONFLICT` |
| `consumed` | Ném `NOT_ALLOWED` |

Step có compensation: nếu một bước phía sau workflow fail, gọi `releaseFirstPurchase(cart_id)` để trả record về `available`.

### Add promotion vào cart

Sau reservation, workflow gọi core Medusa `updateCartPromotionsStep` với:

```ts
{
  id: cart_id,
  promo_codes: ["FIRST_PURCHASE"],
  action: PromotionActions.ADD,
}
```

Đây là điểm promotion được apply programmatically. Code là định danh nội bộ cho Promotion Module, không phải coupon customer nhập.

Cuối workflow, Query Graph đọc lại cart và trả `WorkflowResponse` với cart đã cập nhật.

## Models và module service

Model `FirstPurchaseEntitlement` tại `apps/backend/src/modules/promotion-entitlement/models/first-purchase-entitlement.ts` lưu state riêng của feature:

| Field | Ý nghĩa |
| --- | --- |
| `customer_id` | Unique: mỗi customer có một entitlement |
| `state` | `available`, `reserved`, hoặc `consumed` |
| `cart_id` | Cart đang giữ reservation |
| `order_id` | Order đã tiêu thụ entitlement |
| `reserved_at`, `consumed_at` | Thời điểm state transition |

Module được đăng ký trong `apps/backend/medusa-config.ts`. Feature này không dùng Module Link với Customer hoặc Promotion: customer ID và order/cart ID được giữ dưới dạng text vì entitlement là state nội bộ của custom module. Promotion vẫn thuộc Promotion Module của Medusa.

## Validation khi add promotion và checkout

### Add promotion hook

`apps/backend/src/workflows/hooks/update-cart-promotion-validate.ts` consume hook:

```ts
updateCartPromotionsWorkflow.hooks.validate(...)
```

Nếu request thêm `FIRST_PURCHASE`, `validateFirstPurchasePromotion`:

1. Query customer để xác nhận `has_account`.
2. Resolve `PromotionEntitlementModuleService`.
3. Query entitlement theo `customer_id`.
4. Chỉ cho phép nếu `state === "reserved"` và `entitlement.cart_id === cart.id`.

Hook bảo vệ trường hợp client/API cố thêm code thủ công qua `updateCartPromotionsWorkflow`. Auto-apply workflow dùng core `updateCartPromotionsStep` trực tiếp sau khi đã tạo reservation; checkout hook vẫn là hàng rào cuối cho cart đã được apply.

### Complete cart hook

`apps/backend/src/workflows/hooks/complete-cart-validate.ts` consume:

```ts
completeCartWorkflow.hooks.validate(...)
```

Hook đọc cart, promotions và customer. Nếu cart có `FIRST_PURCHASE`, nó gọi `validateFirstPurchasePromotion` trong file này. Rule giống add hook: registered customer và entitlement phải `reserved` cho đúng cart. Sai điều kiện sẽ ném `MedusaError(INVALID_DATA)` và Medusa không tạo order.

## Consume sau order

Sau complete cart thành công, Medusa phát `order.placed`. Subscriber `apps/backend/src/subscribers/order-placed.ts` gọi:

```ts
consumeFirstPurchaseOnOrderWorkflow(container).run({
  input: { order_id: data.id },
})
```

Workflow `apps/backend/src/workflows/consume-first-purchase-on-order.ts` Query Graph lấy order, customer, cart và `cart.promotions.code`. Nếu có `FIRST_PURCHASE`, workflow gọi `consumeFirstPurchaseStep`.

Step ở `apps/backend/src/workflows/steps/consume-first-purchase.ts` gọi service method:

```ts
entitlementService.consumeFirstPurchase(customer_id, cart_id, order_id)
```

Service update record thành:

```text
state       = consumed
order_id    = order hiện tại
consumed_at = now
```

Từ thời điểm đó, lần cart tiếp theo không thể reserve promotion này nữa.

## State machine

```text
Không có record
  -> available/reserved khi customer đủ điều kiện
  -> reserved khi auto-apply cho cart
  -> consumed khi order có FIRST_PURCHASE được đặt

reserved
  -> available nếu workflow compensation chạy
  -> consumed khi order.placed
```

## Giới hạn hiện tại của learning implementation

- Consume diễn ra trong subscriber `order.placed`, tức sau khi Medusa tạo order; đây là đủ cho luồng tutorial tuần tự, chưa phải transaction atomic cùng complete-cart workflow.
- Không có job tự release reservation của abandoned/expired cart.
- Không có payment/refund/cancel lifecycle vì ngoài phạm vi guide Promotion Module.
