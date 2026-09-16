# Customer Tier: luồng code và cách test

Customer Tier chia customer thành Bronze, Silver hoặc Gold theo tổng chi tiêu, sau đó tự gắn promotion của tier vào cart. Feature có ba phần: quản lý tier ở Admin, cập nhật tier sau order, và hiển thị tiến độ trên storefront.

## Tổng quan luồng

```text
Admin tạo Promotion + Tier + TierRule
  -> Tier Module lưu tier và điều kiện theo currency
  -> Tier liên kết promotion bằng promo_id

Customer hoàn tất order
  -> order.placed subscriber
  -> updateCustomerTierOnOrderWorkflow
  -> tính tổng order hợp lệ cùng currency
  -> tạo/thay Customer ↔ Tier link

Customer cập nhật cart
  -> cart.updated subscriber
  -> addTierPromotionToCartWorkflow
  -> đọc customer.tier.promotion
  -> thêm promotion vào cart nếu chưa có

Checkout / thêm mã promotion
  -> workflow hooks xác minh promotion tier đúng với tier customer
```

## Bản đồ source

| Lớp               | File và thành phần chính                                                                                 | Tác dụng                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Data model        | `src/modules/tier/models/tier.ts`, `tier-rule.ts`                                                        | `Tier` lưu `name`, `promo_id`; `TierRule` lưu ngưỡng `min_purchase_value` theo `currency_code`.        |
| Module service    | `src/modules/tier/service.ts`                                                                            | `calculateQualifyingTier` chọn tier cao nhất đạt ngưỡng; `calculateNextTierUpgrade` tìm mốc kế tiếp.   |
| Module links      | `src/links/tier-customer.ts`, `tier-promotion.ts`                                                        | Liên kết Customer–Tier và read-only Tier–Promotion qua `promo_id`.                                     |
| Admin CRUD        | `src/workflows/create-tier.ts`, `update-tier.ts` cùng `workflows/steps/*tier*`                           | Tạo/sửa tier và rule trong workflow; step có compensation để rollback khi lỗi.                         |
| Admin API         | `src/api/admin/tiers/**/route.ts`                                                                        | List, create, detail, update tier và list customer theo tier.                                          |
| Admin UI          | `src/admin/routes/tiers/**`, `src/admin/components/*tier*`                                               | Trang Customer Tiers, form create/edit, rules table, customer table.                                   |
| Cập nhật hạng     | `src/subscribers/order-placed.ts` → `update-customer-tier-on-order.ts`                                   | Chạy khi `order.placed`, bỏ qua customer guest, chỉ tính order không draft/cancelled và cùng currency. |
| Áp promotion      | `src/subscribers/cart-updated.ts` → `add-tier-promotion-to-cart.ts`                                      | Cart update sẽ lấy tier/promotion của customer và thêm promotion nếu hợp lệ.                           |
| Chống dùng sai mã | `src/workflows/hooks/update-cart-promotions-validate.ts`, `complete-cart-validate.ts`                    | Không cho customer thêm hoặc checkout bằng promotion của tier khác.                                    |
| Store API/UI      | `src/api/store/customers/me/next-tier/route.ts`, `storefront/src/modules/common/customer-tier/index.tsx` | Trả current tier/next tier và render progress bar ở Account, Order Confirmation.                       |

## Chi tiết nghiệp vụ

1. Admin tạo promotion trước, ví dụ giảm 5% cho Silver và 10% cho Gold.
2. Admin tạo tier, chọn promotion và thêm rule. Một tier chỉ có một rule cho mỗi currency.
3. Khi order được đặt, workflow lấy các order hợp lệ của customer trong currency của order vừa đặt. Tổng này được gửi vào `calculateQualifyingTier`.
4. Nếu tier thay đổi, workflow dismiss link cũ rồi tạo link Customer–Tier mới.
5. Lần customer cập nhật cart, subscriber kiểm tra customer đã đăng ký, tier có promotion active và cart chưa có mã đó. Nếu đúng, promotion được thêm.
6. Hook chạy thêm lần nữa khi customer thêm promotion thủ công hoặc complete cart, nên customer không thể dùng mã Gold nếu chỉ thuộc Silver.

## Dữ liệu test nhanh

Script [seed-customer-tiers.ts](../apps/backend/src/scripts/seed-customer-tiers.ts) tạo dữ liệu idempotent:

| Tier   |   Rule VND | Promotion               | Customer             |
| ------ | ---------: | ----------------------- | -------------------- |
| Bronze |          0 | Không có                | `conghung@gmail.com` |
| Silver |  2.000.000 | `TIER_TEST_SILVER` (5%) | `ngocthuc@gmail.com` |
| Gold   | 10.000.000 | `TIER_TEST_GOLD` (10%)  | `congson@gmail.com`  |

Mật khẩu chung: `supersecret`.

Chạy khi cần:

```bash
cd apps/backend
pnpm exec medusa db:migrate
pnpm run seed:customer-tiers
```

## Test trên UI

1. Chạy backend (`pnpm run dev` trong `apps/backend`) và storefront (`pnpm run dev` trong `apps/storefront`).
2. Mở Admin tại `/app` → **Customer Tiers**. Xác nhận có Bronze, Silver, Gold; mở Silver/Gold để xem rule, promotion và customer.
3. Đăng nhập storefront bằng `ngocthuc@gmail.com` hoặc `congson@gmail.com`.
4. Thêm sản phẩm vào cart hoặc cập nhật cart. Promotion của tier phải xuất hiện trong phần discount/promotion của cart.
5. Vào Account để xem current tier và progress đến tier kế tiếp. Hoàn tất order để subscriber tính lại tier.
6. Trong Admin, mở tier tương ứng để xác nhận customer xuất hiện trong bảng **Customers in this Tier**.

> Lưu ý: tier mới chỉ được tính lại sau event `order.placed`. Seed link customer trực tiếp để bạn có thể test UI ngay mà không cần tạo order lịch sử.
