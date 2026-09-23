# Onboarding local development

Tài liệu này hướng dẫn chạy project trên máy local, gồm PostgreSQL và Redis qua Docker, Medusa backend, storefront, seed dữ liệu mẫu, tài khoản admin và cấu hình payment providers đang có trong repo.

## Yêu cầu

- Docker Engine và Docker Compose v2
- Node.js `20.19+` hoặc `22.12+`
- pnpm `10.11.1` (có thể bật bằng `corepack enable`)

## 1. Clone và cài dependencies

```bash
git clone git@github.com:BuiNgocThuc/medusa-core-lab.git
cd medusa-core-lab
docker compose up -d
docker compose ps

cd my-medusa-store
pnpm install
```

`docker compose ps` cần cho thấy hai service `postgres` và `redis` ở trạng thái running (hoặc healthy). Docker Compose publish PostgreSQL tại `localhost:5434` và Redis tại `localhost:6379`.

Nếu một service chưa khởi động được, xem log bằng:

```bash
docker compose logs postgres redis
```

### Reset database local (khi cần seed lại từ đầu)

> Lưu ý: các lệnh dưới đây xoá toàn bộ dữ liệu local trong database `medusa_core_lab_db`. Dừng backend trước khi thực hiện.

Từ thư mục root của repository, drop database cũ rồi tạo lại database mới:

```bash
docker exec -it medusa_core_lab_postgres \
  psql -U admin -d postgres -c "DROP DATABASE IF EXISTS medusa_core_lab_db;"

docker exec -it medusa_core_lab_postgres \
  psql -U admin -d postgres -c "CREATE DATABASE medusa_core_lab_db OWNER admin;"
```

Sau đó tiếp tục từ bước migrate và seed ở dưới.

## 2. Cấu hình backend

Từ thư mục `my-medusa-store`, tạo file môi trường:

```bash
cp apps/backend/.env.template apps/backend/.env
```

Trong `apps/backend/.env`, đặt các giá trị local sau:

```env
PORT=9001
DATABASE_URL=postgres://admin:123456@localhost:5434/medusa_core_lab_db
REDIS_URL=redis://localhost:6379

STORE_CORS=http://localhost:8000
ADMIN_CORS=http://localhost:9001
AUTH_CORS=http://localhost:9001,http://localhost:8000
MEDUSA_BACKEND_URL=http://localhost:9001
```

Tạo và thay thế các giá trị placeholder của `JWT_SECRET`, `COOKIE_SECRET` và `AUTH_MFA_ENCRYPTION_KEY` bằng chuỗi bí mật riêng. Ví dụ:

```bash
openssl rand -hex 32
```

Cloudflare R2 là tùy chọn. Nếu chưa dùng R2, để trống toàn bộ các biến `S3_*`, đặc biệt là `S3_BUCKET`; giá trị placeholder trong file template sẽ kích hoạt module S3.

## 2.1. Cấu hình payment local

Repo hiện có 3 payment paths chính:

- `pp_system_default`: Manual Payment mặc định để test nhanh.
- `pp_bank-transfer_default`: custom Bank Transfer provider, luôn được đăng ký.
- `pp_momo_default`: custom MoMo provider, chỉ được đăng ký khi đủ biến MoMo thật.
- `pp_vnpay_default`: custom VNPay provider, chỉ được đăng ký khi đủ biến VNPay thật.

Bank Transfer chạy được ngay với cấu hình local trong `.env`:

```env
BANK_TRANSFER_BANK_NAME=Demo Bank
BANK_TRANSFER_ACCOUNT_NUMBER=0000000000
BANK_TRANSFER_ACCOUNT_NAME=MEDUSA DEMO MERCHANT
BANK_TRANSFER_REFERENCE_PREFIX=PAY
BANK_TRANSFER_EXPIRY_MINUTES=30
BANK_TRANSFER_WEBHOOK_SECRET=
```

MoMo hiện tại không có mock provider tự động trong `medusa-config.ts`. Nếu chưa có MoMo sandbox credentials, để trống các biến dưới đây để backend không đăng ký `pp_momo_default`:

```env
MOMO_PARTNER_CODE=
MOMO_ACCESS_KEY=
MOMO_SECRET_KEY=
MOMO_REDIRECT_URL=
MOMO_IPN_URL=
```

Khi có MoMo sandbox credentials, đặt tối thiểu:

```env
MOMO_ENDPOINT=https://test-payment.momo.vn
MOMO_PARTNER_CODE=<sandbox-partner-code>
MOMO_ACCESS_KEY=<sandbox-access-key>
MOMO_SECRET_KEY=<sandbox-secret-key>
MOMO_REDIRECT_URL=https://<public-storefront>/api/payment-return/momo
MOMO_IPN_URL=https://<public-backend>/hooks/payment/momo_default
MOMO_AUTO_CAPTURE=true
MOMO_LANG=vi
MOMO_ORDER_EXPIRE_MINUTES=15
```

`MOMO_IPN_URL` phải là public HTTPS URL để MoMo gọi được. Khi dev local, dùng tunnel như ngrok hoặc Cloudflare Tunnel trỏ về backend `http://localhost:9001`, rồi dùng URL public trong `MOMO_IPN_URL`.

VNPay cũng cần credentials sandbox/production thật. Nếu chưa có, để trống:

```env
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
VNPAY_RETURN_URL=
```

Khi có sandbox credentials, đặt tối thiểu:

```env
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_TMN_CODE=<sandbox-tmn-code>
VNPAY_HASH_SECRET=<sandbox-hash-secret>
VNPAY_RETURN_URL=http://localhost:8000/api/payment-return/vnpay
VNPAY_IPN_URL=https://<public-backend>/hooks/payment/vnpay
VNPAY_LOCALE=vn
VNPAY_ORDER_TYPE=other
VNPAY_PAYMENT_EXPIRY_MINUTES=15
```

`VNPAY_IPN_URL` nên là public HTTPS URL trỏ về backend. VNPay IPN hiện dùng custom route `GET /hooks/payment/vnpay` vì VNPay gửi kết quả bằng query params.

## 3. Migrate và seed dữ liệu

Từ `my-medusa-store/apps/backend`, chạy:

```bash
pnpm seed
```

Lệnh seed tự chạy `medusa db:migrate` trước, sau đó nạp catalog, category, tồn kho, khách hàng demo và đơn hàng demo.   


   <!-- docker exec medusa_core_lab_postgres psql -U admin -d postgres -c "DROP DATABASE IF EXISTS medusa_core_lab_db WITH (FORCE);"
docker exec medusa_core_lab_postgres psql -U admin -d postgres -c "CREATE DATABASE medusa_core_lab_db OWNER admin;" -->



Để chạy riêng từng bước:

```bash
pnpm exec medusa db:migrate
pnpm exec medusa exec ./src/migration-scripts/initial-data-seed.ts
```

## 3.1. Bật payment providers cho VND region

Sau khi seed/migrate xong, bật Bank Transfer cho region VND:

```bash
cd my-medusa-store
pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/enable-bank-transfer-provider.ts
```

Expected log:

```text
[bank-transfer] Enabled pp_bank-transfer_default for 1 VND region(s).
```

Nếu đã cấu hình đủ MoMo sandbox credentials, bật thêm MoMo:

```bash
cd my-medusa-store
pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/enable-momo-provider.ts
```

Nếu thiếu biến MoMo, script sẽ báo rõ biến nào thiếu. Đây là hành vi đúng vì provider MoMo không được đăng ký khi credentials chưa đủ.

Nếu đã cấu hình đủ VNPay sandbox credentials, bật thêm VNPay:

```bash
cd my-medusa-store
pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/enable-vnpay-provider.ts
```

Nếu thiếu biến VNPay, script sẽ báo rõ biến nào thiếu.

## 4. Tạo tài khoản admin

Vẫn trong `my-medusa-store/apps/backend`, chạy:

```bash
pnpm medusa user -e admin@medusa.com -p supersecret
```

Đổi email và mật khẩu này trước khi dùng ngoài môi trường local.

## 5. Khởi động ứng dụng

Chạy backend:

```bash
cd my-medusa-store/apps/backend
pnpm dev
```

Mở Medusa Admin tại <http://localhost:9001/app> và đăng nhập bằng tài khoản vừa tạo.

Để chạy cả backend lẫn storefront, từ `my-medusa-store` dùng:

```bash
pnpm dev
```

Storefront mặc định chạy tại <http://localhost:8000>.

## 6. Test nhanh payment flows

Bank Transfer webhook dev dùng route chuẩn của Medusa:

```bash
curl -X POST "http://localhost:9001/hooks/payment/bank-transfer_default" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt_local_success_001",
    "transaction_id": "bank_txn_local_success_001",
    "amount": 410000,
    "currency_code": "vnd",
    "description": "Thanh toan PAY <REFERENCE>",
    "payment_reference": "PAY <REFERENCE>"
  }'
```

Thay `PAY <REFERENCE>` và `amount` bằng reference/số tiền đang hiển thị ở checkout. Nếu `BANK_TRANSFER_WEBHOOK_SECRET` có giá trị, thêm header `x-bank-signature`.

MoMo IPN dùng route chuẩn:

```text
POST /hooks/payment/momo_default
```

Không tự gọi route này bằng payload tự chế trừ khi bạn build đúng chữ ký HMAC theo MoMo, vì provider sẽ verify `partnerCode`, `orderId`, `requestId`, `amount` và `signature`.

Job `reconcile-momo-payments` chạy mỗi 5 phút. Khi MoMo đã cấu hình thật, job query lại MoMo cho các payment `initiated`, `pending`, `authorized`; nếu MoMo báo thành công có `transId`, job ghi event vào ledger và repair Medusa payment bằng workflow `authorized` + `captured`.

VNPay IPN dùng route:

```text
GET /hooks/payment/vnpay
```

Không tự gọi route này bằng query tự chế trừ khi bạn build đúng `vnp_SecureHash`. Provider sẽ verify `vnp_TmnCode`, `vnp_TxnRef`, amount và checksum trước khi mark payment.

## Xử lý sự cố nhanh

- Nếu database hoặc Redis không kết nối được, chạy `docker compose ps` rồi kiểm tra `DATABASE_URL` và `REDIS_URL` trong `apps/backend/.env`.
- Nếu backend không thấy Bank Transfer ở checkout, chạy lại script `enable-bank-transfer-provider.ts` và đảm bảo cart dùng VND region.
- Nếu backend không thấy MoMo ở checkout, kiểm tra đủ 5 biến `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `MOMO_REDIRECT_URL`, `MOMO_IPN_URL`, restart backend rồi chạy `enable-momo-provider.ts`.
- Nếu backend không thấy VNPay ở checkout, kiểm tra đủ `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_RETURN_URL`, restart backend rồi chạy `enable-vnpay-provider.ts`.
- Nếu copy nguyên `.env.template`, đừng để placeholder MoMo dạng `<your-...>` trong `.env` khi chưa có sandbox thật; code sẽ coi đó là cấu hình MoMo đã đủ.
- Nếu seed báo `Cannot find module '@/src/migration-scripts/data'`, import trong `apps/backend/src/migration-scripts/seed/products.ts` phải dùng đường dẫn tương đối: `../data`.
- Cảnh báo `Calling client.query() when the client is already executing a query is deprecated` là warning từ driver PostgreSQL, không phải lỗi seed.
