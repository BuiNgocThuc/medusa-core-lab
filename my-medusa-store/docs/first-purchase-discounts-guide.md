# First-Purchase Discounts: luồng code và cách test

Feature này tự thêm promotion `FIRST_PURCHASE` cho customer đã đăng ký nhưng chưa có order, đồng thời chặn việc dùng lại promotion ở các đơn sau.

## Tổng quan luồng

```text
Cart tạo mới hoặc được transfer sang customer
  -> apply-first-purchase subscriber
  -> applyFirstPurchasePromoWorkflow
  -> kiểm tra cart/customer/order history/promotion
  -> thêm FIRST_PURCHASE vào cart

Customer tự nhập promotion hoặc checkout
  -> validate-promotion hook
  -> xác minh customer có account và chưa có order
  -> cho phép hoặc ném MedusaError

Guest vào storefront
  -> DiscountPopup
  -> mời đăng ký để nhận 10% đơn đầu
```

## Bản đồ source

| Lớp                 | File và thành phần chính                                                                    | Tác dụng                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Constant            | `apps/backend/src/constants.ts` → `FIRST_PURCHASE_PROMOTION_CODE`                           | Một nguồn mã promotion: `FIRST_PURCHASE`.                                                                                                  |
| Workflow            | `src/workflows/apply-first-purchase-promo.ts` → `applyFirstPurchasePromoWorkflow`           | Query cart/customer/orders và promotion; chỉ ADD promotion nếu customer chưa có order và cart chưa có mã.                                  |
| Subscriber          | `src/subscribers/apply-first-purchase.ts` → `cartCreatedHandler`                            | Lắng nghe `cart.created` và `cart.customer_transferred`, sau đó chạy workflow. Event transfer xử lý cart guest sau khi customer đăng nhập. |
| Add validation      | `src/workflows/hooks/validate-promotion.ts` → `updateCartPromotionsWorkflow.hooks.validate` | Chặn customer không đăng nhập hoặc đã có order khi họ cố thêm mã thủ công.                                                                 |
| Checkout validation | Cùng file → `completeCartWorkflow.hooks.validate`                                           | Kiểm tra lại điều kiện ngay trước lúc tạo order.                                                                                           |
| Promotion setup     | `src/migration-scripts/setup-promotions.ts`                                                 | Tạo promotion active `FIRST_PURCHASE` nếu chưa tồn tại.                                                                                    |
| Storefront popup    | `src/modules/common/components/discount-popup/index.tsx`                                    | Popup chỉ hiện cho guest một lần, lưu flag `discount_popup_shown` trong localStorage.                                                      |
| Layout/login        | `src/app/[countryCode]/(main)/layout.tsx`, `modules/account/templates/login-template.tsx`   | Layout render popup khi chưa có customer; account mặc định mở form register.                                                               |

## Chi tiết nghiệp vụ

1. Promotion `FIRST_PURCHASE` phải tồn tại và active.
2. Khi subscriber nhận cart event, workflow dùng Query Graph lấy `promotions.*`, `customer.*`, `customer.orders.*`.
3. Promotion chỉ được thêm khi: promotion tồn tại, cart chưa có promotion đó, cart có customer, và `customer.orders.length === 0`.
4. Nếu customer tự thêm code, hook kiểm tra `cart.customer_id`, `customer.has_account` và order history.
5. Khi checkout, hook chạy lại cùng rule. Đây là lớp bảo vệ quan trọng vì cart có thể tồn tại lâu hoặc customer có thể đã đặt order khác giữa hai thời điểm.

## Cấu hình promotion

Tạo bằng Admin → Promotions, hoặc dùng script:

```bash
cd apps/backend
pnpm run setup:promotions
```

Promotion cần có code chính xác `FIRST_PURCHASE`, trạng thái active. Script hiện tạo promotion percentage 10% trên items, phân bổ across items.

## Test trên UI

1. Chạy backend và storefront.
2. Mở storefront trong cửa sổ ẩn danh hoặc xóa localStorage key `discount_popup_shown` để thấy popup.
3. Nhấn **Register & Save 10%**. Trang Account hiển thị registration form trước login.
4. Đăng ký customer mới, thêm sản phẩm vào cart. Sau khi cart transfer sang customer, promotion `FIRST_PURCHASE` phải xuất hiện trong checkout/cart summary.
5. Hoàn tất order đầu tiên.
6. Với cùng account, tạo cart mới: promotion không được tự thêm.
7. Thử nhập `FIRST_PURCHASE` thủ công: backend phải trả lỗi rằng discount chỉ dành cho customer chưa có order.

> Nếu popup không hiện, hãy đăng xuất và xóa `discount_popup_shown` trong browser DevTools → Application → Local Storage.
