# Customer Tier — Review và kịch bản test

## Blocker cần sửa trước khi seed/test

| Mức độ | File | Vấn đề | Hậu quả | Cách sửa đề xuất |
| --- | --- | --- | --- | --- |
| Critical | `src/api/admin/tiers/route.ts` | Query Graph dùng `entity: "tiers"` | API `GET /admin/tiers` không tìm được entity; Admin list trống/lỗi. | Đổi thành `entity: "tier"`. |
| Critical | `src/modules/tier/migrations/` | Chưa có migration Tier trong source hiện tại. | Project mới không có bảng `tier`/`tier_rule`; không thể seed. | Chạy `pnpm exec medusa db:generate tier`, commit migration mới, rồi `db:migrate`. |
| Critical | `src/modules/tier/service.ts` | `calculateQualifyingTier` sort tăng dần rồi `find` rule đầu tiên đạt điều kiện. | Customer đạt Gold vẫn nhận Bronze nếu Bronze có ngưỡng 0. | Sort giảm dần: `b.min_purchase_value - a.min_purchase_value`; truy vấn rules kèm relation `tier`. |
| High | `src/admin/components/index.tsx` | Barrel import có đuôi `.tsx`, nhưng backend tsconfig không bật `allowImportingTsExtensions`. | `pnpm exec tsc --noEmit` fail. | Bỏ đuôi `.tsx` trong export hoặc đổi file barrel sang import không extension. |
| High | `src/admin/lib/sdk.ts` | Root backend tsc compile Admin như CommonJS nên báo lỗi `import.meta`. | Type-check backend fail. | Tách Admin type-check bằng nested tsconfig/Vite config hoặc loại `src/admin` khỏi backend CJS tsconfig; không đổi Admin code sang `process.env`. |

> Không seed Tier trước khi 3 blocker Critical được xử lý. Seed có thể tạo data không đọc được hoặc gán sai tier.

## Seed fixture mong muốn

Sau khi sửa blocker, seed idempotent cần tạo:

| Customer | Password | Tier | Rule VND | Promotion |
| --- | --- | --- | ---: | --- |
| `conghung@gmail.com` | `supersecret` | Bronze | 0 | Không có |
| `ngocthuc@gmail.com` | `supersecret` | Silver | 2.000.000 | `TIER_TEST_SILVER`, 5% |
| `congson@gmail.com` | `supersecret` | Gold | 10.000.000 | `TIER_TEST_GOLD`, 10% |

Seeder phải thực hiện theo thứ tự: tạo/find promotion → tạo/find tier → tạo/find tier rule → tạo/find customer account → dismiss link tier cũ nếu khác → create Customer–Tier link mới.

## Kịch bản test

### 1. Admin list và CRUD Tier

1. Chạy migration và seed.
2. Vào `/app/tiers`.
3. Mong đợi: thấy Bronze, Silver, Gold; không phải list rỗng.
4. Tạo tier `Platinum`, rule VND 20.000.000 và chọn một promotion.
5. Mở detail tier, sửa rule, reload trang.
6. Mong đợi: API list/detail/update trả đúng `tier_rules` và promotion.

### 2. Automatic tier promotion trên cart

1. Đăng nhập `ngocthuc@gmail.com`.
2. Tạo/update cart bằng cách thêm product.
3. Mong đợi: event `cart.updated` chạy subscriber; `TIER_TEST_SILVER` xuất hiện trong cart.
4. Lặp lại với `congson@gmail.com`.
5. Mong đợi: chỉ có `TIER_TEST_GOLD`; không thêm trùng promotion sau nhiều lần update cart.
6. Đăng nhập Bronze.
7. Mong đợi: cart không có tier promotion.

### 3. Chặn promotion sai tier

1. Đăng nhập Silver customer.
2. Thử add `TIER_TEST_GOLD` qua form discount code/API.
3. Mong đợi: `INVALID_DATA`, message nói promotion chỉ dành cho tier tương ứng.
4. Đăng nhập Gold, thử lại mã Gold.
5. Mong đợi: thành công.

### 4. Recalculate tier sau order

1. Tạo/seed customer không có tier hoặc Bronze.
2. Tạo order completed VND với tổng dưới 2.000.000.
3. Mong đợi: link là Bronze.
4. Tạo thêm order để tổng đạt 2.000.000.
5. Mong đợi: subscriber `order.placed` chuyển link sang Silver.
6. Tạo thêm order để tổng đạt 10.000.000.
7. Mong đợi: link chuyển Gold, không còn link Silver.

### 5. Currency isolation

1. Tạo rules VND và USD có ngưỡng khác nhau.
2. Tạo order VND đủ Silver nhưng order USD thấp.
3. Mong đợi: workflow chỉ cộng order cùng currency với order đang xử lý; không cộng số tiền VND và USD vào một tổng.

### 6. Storefront next-tier progress

1. Đăng nhập Silver customer.
2. Vào Account hoặc Order Confirmation.
3. Mong đợi: `GET /store/customers/me/next-tier` trả current tier, current purchase value và next tier Gold.
4. UI hiển thị progress bar cùng số tiền còn thiếu.

## Lệnh xác minh sau khi sửa

```bash
cd apps/backend
pnpm exec medusa db:generate tier
pnpm exec medusa db:migrate
pnpm run lint
pnpm run seed:customer-tiers
```

Sau đó chạy backend/storefront, thực hiện các kịch bản theo thứ tự từ 1 đến 6.
