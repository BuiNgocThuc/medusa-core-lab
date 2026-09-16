# Medusa v2 / Node.js Backend Rules

Đây là bộ nguyên tắc cốt lõi khi làm việc với Medusa v2 (Turborepo workspace, Node.js, DML).

## 1. Kiến trúc Workspace
- Medusa v2 sử dụng pnpm workspace. Không bao giờ chạy npm install ở thư mục gốc nếu package manager là pnpm.
- Backend nằm ở `my-medusa-store/apps/backend`. Storefront nằm ở `my-medusa-store/apps/storefront`.
- Luôn detect package manager (pnpm/yarn/npm) trước khi chạy lệnh.

## 2. Lập trình Backend (Medusa Core)
- **Data Model:** KHÔNG sử dụng TypeORM. Medusa v2 sử dụng hệ thống DML (Data Modeling Language) để khai báo model. Ví dụ: `import { model } from "@medusajs/framework/utils"`.
- **API Routes:** Routing dựa trên file system (File-based routing). Đặt file `route.ts` trong thư mục `src/api/store/` hoặc `src/api/admin/`. KHÔNG dùng Express router `app.get()`.
- **Business Logic:** KHÔNG viết logic tính toán trực tiếp trong API route. Mọi logic phức tạp phải được đóng gói vào **Workflows** và các Steps để đảm bảo tính rollback (Saga pattern) đặc trưng của Medusa.

## 3. Quản lý Database & Migrations
- Các thay đổi model phải được gen migration bằng lệnh: `npx medusa db:generate <module-name>`.
- Chạy migration bằng lệnh: `npx medusa db:migrate`.
- KHÔNG viết lệnh DROP TABLE trực tiếp vào DB, không ghi thẳng raw SQL vào backend trừ trường hợp cực kỳ bất khả kháng.

## 4. Linting & Formatting
- Code backend phải tuân thủ chặt chẽ rule của `@medusajs/eslint-plugin`. Lint failure thường có nghĩa là code sai cấu trúc (ví dụ route hoặc workflow trả về sai kiểu), chứ không chỉ đơn thuần là lỗi format.
- KHÔNG BAO GIỜ tắt rule `@medusajs/*` bằng comment `// eslint-disable-next-line`. Hãy sửa lại code cho đúng.

## 5. Security & Off-Limits
- Cấm đọc/in/lưu trữ các biến môi trường nhạy cảm trong console (như SECRET_KEY, DATABASE_URL).
- Cấm thao tác vào các thư mục build: `.medusa/`, `.next/`, `dist/`.
