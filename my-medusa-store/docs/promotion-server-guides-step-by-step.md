# Promotion Module — Code lại từng bước

Hướng dẫn này dùng cho hai server guides: **Customer Tiers** và **First-Purchase Discounts**.

Mỗi bước có cùng cấu trúc:

1. **Tạo file ở đâu** — đường dẫn source chính xác.
2. **File làm gì** — lý do kiến trúc.
3. **Code mẫu** — copy/gõ lại trực tiếp ngay sau phần giải thích.
4. **Checkpoint** — điều cần hiểu trước khi qua bước kế tiếp.

> Quy ước: code bên dưới là code đang có trong project. Hãy gõ lại lần lượt, không gõ tất cả cùng lúc.

# A. Customer Tiers

## A1. Tạo Tier Module dữ liệu

### 1. Các file tạo ra

- [tier.ts](../apps/backend/src/modules/tier/models/tier.ts)
- [tier-rule.ts](../apps/backend/src/modules/tier/models/tier-rule.ts)
- [service.ts](../apps/backend/src/modules/tier/service.ts)
- [index.ts](../apps/backend/src/modules/tier/index.ts)

### 2. Vai trò

`Tier` là định nghĩa hạng: tên và promotion đi kèm. `TierRule` là điều kiện đạt hạng theo currency. `TierModuleService` chứa rule tính tier; module `index.ts` đăng ký service với Medusa container qua key `tier`.

### 3. Code mẫu

## A2. Tạo Module Links

### 1. Các file tạo ra

- [tier-customer.ts](../apps/backend/src/links/tier-customer.ts)
- [tier-promotion.ts](../apps/backend/src/links/tier-promotion.ts)

### 2. Vai trò

Không thêm `tier_id` trực tiếp vào Customer. Module Link tạo quan hệ Customer ↔ Tier; read-only link còn lại đọc Promotion từ `Tier.promo_id`.

### 3. Code mẫu

## A3. Tạo và sửa Tier bằng workflow/API

### 1. Các file tạo ra

- [create-tier step](../apps/backend/src/workflows/steps/create-tier.ts)
- [create-tier-rules step](../apps/backend/src/workflows/steps/create-tier-rules.ts)
- [create-tier workflow](../apps/backend/src/workflows/create-tier.ts)
- [tiers API](../apps/backend/src/api/admin/tiers/route.ts)
- [tier detail API](../apps/backend/src/api/admin/tiers/[id]/route.ts)
- [API middleware](../apps/backend/src/api/middlewares.ts)

### 2. Vai trò

Workflow validate promotion, tạo Tier, tạo TierRule và có compensation rollback. API route chỉ nhận HTTP request rồi gọi workflow; không chứa business logic.

### 3. Code mẫu

## A4. Tự cập nhật tier sau order

### 1. Các file tạo ra

- [validate-customer step](../apps/backend/src/workflows/steps/validate-customer.ts)
- [determine-tier step](../apps/backend/src/workflows/steps/determine-tier.ts)
- [update-customer-tier-on-order workflow](../apps/backend/src/workflows/update-customer-tier-on-order.ts)
- [order-placed subscriber](../apps/backend/src/subscribers/order-placed.ts)

### 2. Vai trò

Subscriber nhận `order.placed`. Workflow lấy order history hợp lệ cùng currency, cộng `order.total`, chọn tier cao nhất đủ ngưỡng, rồi thay Customer–Tier link cũ nếu tier đổi.

### 3. Code mẫu

## A5. Tự apply promotion tier vào cart

### 1. Các file tạo ra

- [validate-tier-promotion step](../apps/backend/src/workflows/steps/validate-tier-promotion.ts)
- [add-tier-promotion-to-cart workflow](../apps/backend/src/workflows/add-tier-promotion-to-cart.ts)
- [cart-updated subscriber](../apps/backend/src/subscribers/cart-updated.ts)

### 2. Vai trò

Workflow lock cart, đọc `customer.tier.promotion`, kiểm tra promotion active/chưa được add, rồi gọi core `updateCartPromotionsWorkflow` với action `ADD`.

### 3. Code mẫu

## A6. Validate và hiển thị tier

### 1. Các file tạo ra

- [validate-promotion hook](../apps/backend/src/workflows/hooks/validate-promotion.ts)
- [next-tier Store API](../apps/backend/src/api/store/customers/me/next-tier/route.ts)
- [tier Storefront component](../apps/storefront/src/modules/common/customer-tier/index.tsx)

### 2. Vai trò

Hook chỉ được đăng ký một lần cho mỗi core workflow. Nó chặn promotion của tier khác. Store API trả current/next tier; storefront render progress bar.

### 3. Code mẫu

# B. First-Purchase Discounts

## B1. Khai báo promotion code và auto-apply workflow

### 1. Các file tạo ra

- [constants.ts](../apps/backend/src/constants.ts)
- [apply-first-purchase-promo workflow](../apps/backend/src/workflows/apply-first-purchase-promo.ts)
- [apply-first-purchase subscriber](../apps/backend/src/subscribers/apply-first-purchase.ts)

### 2. Vai trò

Mã `FIRST_PURCHASE` nằm ở constant. Subscriber chạy khi cart mới tạo hoặc được transfer sang customer. Workflow chỉ add mã nếu cart có customer và customer chưa có order.

### 3. Code mẫu

## B2. Validate discount khi add code và checkout

### 1. File cần sửa

- [validate-promotion hook](../apps/backend/src/workflows/hooks/validate-promotion.ts)

### 2. Vai trò

Cùng một handler với Customer Tier: nếu cart có `FIRST_PURCHASE`, customer phải có account và `orders.length === 0`. Không tạo file hook thứ hai vì Medusa không cho nhiều handler `validate`.

### 3. Code mẫu

## B3. Hiển thị popup cho guest

### 1. Các file tạo/sửa

- [discount-popup](../apps/storefront/src/modules/common/components/discount-popup/index.tsx)
- [main layout](<../apps/storefront/src/app/[countryCode]/(main)/layout.tsx>)
- [login template](../apps/storefront/src/modules/account/templates/login-template.tsx)

### 2. Vai trò

Popup chỉ là UX marketing cho guest, lưu flag localStorage để hiện một lần. Rule nghiệp vụ vẫn nằm ở backend workflow/hook. Login template mở register trước để phù hợp CTA popup.

### 3. Code mẫu
