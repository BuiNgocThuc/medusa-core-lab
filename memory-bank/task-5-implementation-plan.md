# Kế hoạch Triển khai Task 5: Loyalty Module & Module Link (Chính thức & Sẵn sàng Thực thi)

Mục tiêu: Xây dựng module `loyalty` độc lập với model `LoyaltyAccount` theo mô hình Hybrid Reference, thiết lập Stored Module Link liên kết với `Customer`, đồng bộ schema cơ sở dữ liệu qua migration, kiểm chứng toàn diện qua bộ Integration Test (`medusaIntegrationTestRunner`) trên môi trường runtime Medusa 2.20.1, và chuẩn bị script CLI kiểm chứng dữ liệu dev.

---

## 1. Kết quả Xác minh & Tiếp thu Phản hồi Chi tiết

1. **Ngữ nghĩa Lỗi của CLI Script (`verify-loyalty.ts`)**:
   - Ném lỗi tường minh (`throw new Error(...)`) trong mọi nhánh không hợp lệ: thiếu `customer_id`, không tìm thấy `Customer`, thiếu `loyalty_account`, hoặc dữ liệu lệch `customer_id`.
   - Medusa CLI sẽ tự động bắt lỗi và trả về exit code khác 0. Chỉ log thành công và thoát bình thường khi tìm thấy đúng 1 `LoyaltyAccount` hợp lệ khớp với Customer.
2. **Kiểm tra Schema Bảng Link & Ràng buộc 1–1**:
   - Sau `db:migrate`, ghi nhận schema thực tế từ PostgreSQL (tên bảng link, các cột ID, index/constraint trên từng cột) và xác nhận **không có Foreign Key** nào nối sang bảng `customer` hay `loyalty_account`.
   - Hành vi chặn quan hệ 1–1 được kiểm chứng dứt khoát qua integration test (`link.create` vi phạm ném `INVALID_DATA`).
3. **Quy ước `points` & Khởi tạo `tier` Enum**:
   - `points: model.number().default(0)` chỉ đặt mặc định 0 ở database; quy tắc "số nguyên không âm" là quy tắc nghiệp vụ dự kiến cho Task 6, chưa được thực thi bằng ràng buộc DB trong Task 5.
   - `tier`: Định nghĩa `model.enum(Object.values(LoyaltyTier)).default(LoyaltyTier.BRONZE)`.
4. **Cô lập Test Suite & Resolve Link Service**:
   - Test suite resolve link service qua `container.resolve(ContainerRegistrationKeys.LINK)`.
   - Mỗi test case tự khởi tạo cặp thực thể riêng. Ca test minh họa "Hybrid Drift" chỉ chạy trong cơ sở dữ liệu tạm thời của `medusaIntegrationTestRunner`, đảm bảo không ảnh hưởng đến dev database.
5. **Ghi nhận Giới hạn Vận hành vào Lộ trình (Roadmap Integration)**:
   - Giới hạn: Workflow xóa Customer của core ([`delete-customers.ts:46`](file:///home/ubuntu/Data_D/SmartOSC/project/backend/nodejs/medusa-learn/medusa-core-source/packages/core/core-flows/src/customer/workflows/delete-customers.ts#L46)) không tự dọn custom link.
   - **Xử lý**: Đã bổ sung chính thức hạng mục này vào phạm vi của **Task 6** trong [`LEARNING_PLAN.md`](file:///home/ubuntu/Data_D/SmartOSC/project/backend/nodejs/medusa-core-lab/LEARNING_PLAN.md#L161) ("Mở rộng: Xây dựng workflow/hook dọn dẹp LoyaltyAccount và Module Link khi xóa Customer").
6. **Môi trường Runtime Thực tế**:
   - Toàn bộ hành vi (đặc biệt là link validation, migration, lint và build) **sẽ được xác nhận trực tiếp bằng việc thực thi migration, integration test, lint và build trên môi trường backend Medusa 2.20.1**, thay vì chỉ dựa vào phân tích tĩnh từ mã nguồn checkout Core 2.21.0.

---

## 2. Chi tiết các tệp thay đổi (Proposed Changes)

### Tầng Module Loyalty (`apps/backend/src/modules/loyalty`)

#### [NEW] `apps/backend/src/modules/loyalty/models/loyalty-account.ts`
```typescript
import { model } from "@medusajs/framework/utils"

export const LoyaltyTier = {
  BRONZE: "BRONZE",
  SILVER: "SILVER",
  GOLD: "GOLD",
} as const

export const LoyaltyAccount = model.define("loyalty_account", {
  id: model.id().primaryKey(),
  customer_id: model.text().unique(),
  points: model.number().default(0),
  tier: model.enum(Object.values(LoyaltyTier)).default(LoyaltyTier.BRONZE),
})
```

#### [NEW] `apps/backend/src/modules/loyalty/service.ts`
```typescript
import { MedusaService } from "@medusajs/framework/utils"
import { LoyaltyAccount } from "./models/loyalty-account"

export default class LoyaltyModuleService extends MedusaService({
  LoyaltyAccount,
}) {}
```

#### [NEW] `apps/backend/src/modules/loyalty/index.ts`
```typescript
import { Module } from "@medusajs/framework/utils"
import LoyaltyModuleService from "./service"

export const LOYALTY_MODULE = "loyalty"

export default Module(LOYALTY_MODULE, {
  service: LoyaltyModuleService,
})
```

---

### Tầng Module Link (`apps/backend/src/links`)

#### [NEW] `apps/backend/src/links/customer-loyalty.ts`
```typescript
import CustomerModule from "@medusajs/medusa/customer"
import LoyaltyModule from "../modules/loyalty"
import { defineLink } from "@medusajs/framework/utils"

export default defineLink(
  CustomerModule.linkable.customer,
  LoyaltyModule.linkable.loyaltyAccount
)
```

---

### Tầng Cấu hình Ứng dụng

#### [MODIFY] `apps/backend/medusa-config.ts`
- Đăng ký module loyalty vào đối tượng `modules`:
  ```typescript
  {
    resolve: "./src/modules/loyalty",
  }
  ```

---

### Tầng Kiểm thử Tích hợp Toàn diện (`apps/backend/src/modules/loyalty/__tests__`)

#### [NEW] `apps/backend/src/modules/loyalty/__tests__/link.spec.ts`
Chạy bằng `medusaIntegrationTestRunner` trong bộ `test:integration:modules`:
1. **Default Values**: Tạo `LoyaltyAccount` chỉ với `customer_id`, kiểm tra `points === 0` và `tier === "BRONZE"`.
2. **Unique customer_id Constraint**: Tạo hai bản ghi `LoyaltyAccount` có cùng `customer_id` -> Kỳ vọng ném lỗi vi phạm unique index.
3. **Happy Path Query Graph**: Resolve `ContainerRegistrationKeys.LINK`, gọi `link.create`, sau đó dùng `query.graph` -> Nhận diện chính xác `customer.loyalty_account`.
4. **Link Isolation Test**: Tạo Customer A và LoyaltyAccount có `customer_id = customerA.id` nhưng **không gọi link.create** -> `query.graph` từ Customer A trả về `loyalty_account: null/undefined`.
5. **1-to-1 Constraint Rejection**: Tạo link thứ hai nối cùng một Customer tới một LoyaltyAccount khác -> Kỳ vọng ném lỗi `MedusaError.Types.INVALID_DATA` và link đầu tiên được bảo toàn.
6. **Hybrid Drift Illustration (Giới hạn cấu trúc của Task 5)**: Nối Customer A với LoyaltyAccount có `customer_id` của Customer B -> `query.graph` vẫn trả về theo stored link, chứng minh rằng nếu không có transactional workflow ở tầng ghi, model hybrid có thể bị lệch cặp ID.

---

### Tầng CLI Script (`apps/backend/src/scripts`)

#### [NEW] `apps/backend/src/scripts/verify-loyalty.ts`
```typescript
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function verifyLoyalty({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const customerId = args?.[0]
  if (!customerId) {
    throw new Error(
      "Vui lòng cung cấp Customer ID: pnpm exec medusa exec ./src/scripts/verify-loyalty.ts <customer_id>"
    )
  }

  const { data } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "loyalty_account.*"],
    filters: { id: customerId },
  })

  const customer = data?.[0]
  if (!customer) {
    throw new Error(`Không tìm thấy Customer với ID: ${customerId}`)
  }

  const loyaltyAccount = customer.loyalty_account
  if (!loyaltyAccount) {
    throw new Error(`Customer ${customerId} không có LoyaltyAccount được liên kết.`)
  }

  if (loyaltyAccount.customer_id !== customer.id) {
    throw new Error(
      `Phát hiện lệch dữ liệu: LoyaltyAccount.customer_id (${loyaltyAccount.customer_id}) không khớp với Customer.id (${customer.id})`
    )
  }

  logger.info(`Customer: ${customer.id} (${customer.email})`)
  logger.info(`Loyalty Data: ${JSON.stringify(loyaltyAccount, null, 2)}`)
}
```

---

## 3. Quy trình Thực thi & Lệnh CLI (Execution Workflow)

Tất cả các lệnh thực hiện tại thư mục `apps/backend`:

```bash
cd /home/ubuntu/Data_D/SmartOSC/project/backend/nodejs/medusa-core-lab/my-medusa-store/apps/backend
```

1. **Sinh migration cho model LoyaltyAccount**:
   ```bash
   pnpm exec medusa db:generate loyalty
   ```
2. **Áp dụng migration và đồng bộ bảng Link**:
   ```bash
   pnpm exec medusa db:migrate
   ```
3. **Kiểm tra schema thực tế trong Database**:
   - Kiểm tra tên bảng link thực tế, các cột ID, index/constraint trên từng cột.
   - Xác nhận **không có Foreign Key** nào nối từ bảng link sang `customer` hoặc `loyalty_account`.
4. **Chạy bộ kiểm thử tích hợp (Integration Test)**:
   ```bash
   pnpm test:integration:modules
   ```
5. **Chạy Typecheck / Lint / Build kiểm tra an toàn**:
   ```bash
   pnpm exec medusa lint
   pnpm run build
   ```
6. **(Tùy chọn - Bước phụ trợ) Chạy script kiểm chứng trên môi trường dev**:
   *(Tiền điều kiện: Cần có một fixture Customer và LoyaltyAccount đã được liên kết trên database dev)*
   ```bash
   pnpm exec medusa exec ./src/scripts/verify-loyalty.ts <customer-id>
   ```

---

## 4. Tiêu chuẩn Hoàn thành (Definition of Done)

### Cổng Nghiệm thu Bắt buộc (Hard Mandatory Gates):
- [ ] Model `LoyaltyAccount` định nghĩa `tier` bằng `model.enum(Object.values(LoyaltyTier)).default(LoyaltyTier.BRONZE)` và `points` bằng `model.number().default(0)`.
- [ ] Module `loyalty` export đúng chuẩn v2 và đăng ký thành công trong `medusa-config.ts`.
- [ ] File migration của `loyalty` nằm trong `apps/backend/src/modules/loyalty/migrations`.
- [ ] Bảng link được tạo trong cơ sở dữ liệu sau `pnpm exec medusa db:migrate`; xác nhận không có Foreign Key constraint sang hai bảng module.
- [ ] 100% các ca kiểm thử trong `src/modules/loyalty/__tests__/link.spec.ts` vượt qua (Pass) khi chạy `pnpm test:integration:modules` trên runtime Medusa 2.20.1.
- [ ] Lệnh `pnpm exec medusa lint` và `pnpm run build` chạy thành công không có lỗi syntax hoặc type error.

### Cổng Xác minh Phụ trợ (Optional Dev Verification):
- [ ] Script `verify-loyalty.ts` tuân thủ `ExecArgs`, ném lỗi rõ ràng khi thiếu ID/lệch dữ liệu, và chạy thành công khi truyền đúng ID của Customer đã có liên kết hợp lệ trên dev.

---

## 5. Ghi chú Bàn giao cho Task 6 (Handoff to Task 6)

1. **Transactional Write Workflow**: Task 5 chỉ xây dựng cấu trúc và fixture trong kiểm thử tích hợp. Trước khi bước vào luồng cấp điểm thực tế, Task 6 cần thiết kế workflow tạo đồng thời `Customer`, `LoyaltyAccount` và `Module Link` với compensation logic để hoàn tác nếu một bước thất bại.
2. **Hiển thị Điểm trên Admin & Storefront API**: Sau Task 5, Query Graph đã sẵn sàng nội bộ ở backend nhưng Storefront (`/store/customers/me`) và Admin widget (`customer-extra-details.tsx`) hiện chưa có đường đọc dữ liệu loyalty. Task 6 sẽ cần thiết kế endpoint/đường đọc API và bổ sung widget hiển thị điểm cụ thể trên Admin Dashboard.
3. **Dọn dẹp liên kết khi xóa Customer**: Đã được ghi nhận vào `LEARNING_PLAN.md` (line 161) để xây dựng workflow/hook xử lý bản ghi mồ côi khi xóa Customer.
