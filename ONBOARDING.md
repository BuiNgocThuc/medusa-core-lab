# Onboarding local development

Tài liệu này hướng dẫn chạy project trên máy local, gồm PostgreSQL và Redis qua Docker, Medusa backend, seed dữ liệu mẫu và tài khoản admin.

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

`docker compose ps` cần cho thấy hai service `postgres` và `redis` ở trạng thái running (hoặc healthy). Docker Compose publish PostgreSQL tại `localhost:5432` và Redis tại `localhost:6379`.

Nếu một service chưa khởi động được, xem log bằng:

```bash
docker compose logs postgres redis
```

## 2. Cấu hình backend

Từ thư mục `my-medusa-store`, tạo file môi trường:

```bash
cp apps/backend/.env.template apps/backend/.env
```

Trong `apps/backend/.env`, đặt các giá trị local sau:

```env
PORT=9001
DATABASE_URL=postgres://admin:123456@localhost:5432/medusa_core_lab_db
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

## 3. Migrate và seed dữ liệu

Từ `my-medusa-store/apps/backend`, chạy:

```bash
pnpm seed
```

Lệnh seed tự chạy `medusa db:migrate` trước, sau đó nạp catalog, category, tồn kho, khách hàng demo và đơn hàng demo.

Để chạy riêng từng bước:

```bash
pnpm exec medusa db:migrate
pnpm exec medusa exec ./src/migration-scripts/initial-data-seed.ts
```

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

## Xử lý sự cố nhanh

- Nếu database hoặc Redis không kết nối được, chạy `docker compose ps` rồi kiểm tra `DATABASE_URL` và `REDIS_URL` trong `apps/backend/.env`.
- Nếu seed báo `Cannot find module '@/src/migration-scripts/data'`, import trong `apps/backend/src/migration-scripts/seed/products.ts` phải dùng đường dẫn tương đối: `../data`.
- Cảnh báo `Calling client.query() when the client is already executing a query is deprecated` là warning từ driver PostgreSQL, không phải lỗi seed.
