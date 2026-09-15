# Kế hoạch Triển khai (Bản Hoàn Thiện Tuyệt Đối) - Task 3: Workflow Hook Customization (createCustomersWorkflow Hook)

Tài liệu thiết kế kiến trúc và kế hoạch triển khai chuẩn mực cho **Task 3: Workflow Hook Customization** theo tiêu chuẩn **building-with-medusa**, **Zen Code Style (Profile: lab-personal)**, đặc tả [LEARNING_PLAN.md](file:///home/ubuntu/Data_D/SmartOSC/project/backend/nodejs/medusa-core-lab/LEARNING_PLAN.md), và **Checklist 12 Bước Chuẩn Staff Engineer khi Nhận Task**.

Trạng thái: **Approved for Implementation** (Đã thông qua toàn bộ thẩm định kiến trúc, transaction, batch contract, type-safety tuyệt đối và test strategy).

---

## 1. Tổng quan & Bối cảnh Task 3

Trong lộ trình Customer Module tại [LEARNING_PLAN.md](file:///home/ubuntu/Data_D/SmartOSC/project/backend/nodejs/medusa-core-lab/LEARNING_PLAN.md), Task 3 thuộc **Cluster 1: Foundation & Extensions (Dễ - Trung bình)**:

- **Tiền đề đã hoàn thành:**
  - **Task 1 [Dễ]:** Subscriber `customer-created.ts` lắng nghe sự kiện `customer.created` gửi email chào mừng bất đồng bộ kèm idempotency key.
  - **Task 2 [Dễ]:** Middleware `middlewares.ts` validate `additional_data` (`zalo_id`, `avatar_url`) cho route `POST /admin/customers`.
- **Mục tiêu Task 3 [Trung bình]:**
  - Tiêu thụ điểm neo Workflow Hook `createCustomersWorkflow.hooks.customersCreated`.
  - Sử dụng schema chung `customerAdditionalDataSchema` (Single Source of Truth) từ `src/utils/customer-additional-data.ts`.
  - Tách rời isolated/testable hook handler khỏi file đăng ký để hỗ trợ unit test trực tiếp, không gây side-effect.
  - Đồng bộ an toàn vào trường `metadata` của Customer qua `customerModuleService.updateCustomers(customer.id, { metadata: extraData })`.
  - Tận dụng cơ chế `mergeMetadata` có sẵn trong Medusa v2.20.1 để giữ nguyên các key metadata hiện có.
  - Đảm bảo type-safety 100% với `StepExecutionContext` và inferred type `CustomerAdditionalData`.
  - Trả về `StepResponse` đúng chuẩn building-with-medusa và tận dụng default no-op compensation của SDK.
  - Chặn đứng rủi ro gán sai dữ liệu khi chạy batch: Từ chối dứt khoát bằng `MedusaError(INVALID_DATA)` nếu truyền dữ liệu cá nhân cho số lượng customer khác 1 (`customers.length !== 1`).
  - Áp dụng đầy đủ chuẩn kiểm thử 3 tầng: Unit Test đầy đủ các ca biên, HTTP Integration Test (có auth adminHeaders, email ngẫu nhiên, cleanup qua try/finally), Rollback Verification và Build Gate.
- **Điểm đến tiếp theo:**
  - **Task 4 [Trung bình]:** Xây dựng Admin Widget `customer.details` hiển thị trực quan Zalo ID và Avatar trên giao diện Medusa Admin.

---

## 2. Các Quyết Định Kiến Trúc Cốt Lõi (Approved Architectural Decisions)

> [!IMPORTANT]
> **Quyết định 1: Chính sách Xử lý Batch Dứt khoát (Definitive Batch Policy)**
> - Trong Core Workflow `createCustomersWorkflow`, `customersData` là mảng nhưng `additional_data` là một đối tượng dùng chung.
> - `zalo_id` và `avatar_url` là thông tin cá nhân duy nhất. Không dùng `console.warn` để tránh silent data loss.
> - **Thứ tự xử lý chuẩn:**
>   1. Parse các field thuộc Task 3 từ `additional_data` qua schema chung.
>   2. Không có field liên quan đến Task 3 -> Trả về `new StepResponse()` (No-op an toàn, cho phép batch chứa additional_data của module/customization khác chạy bình thường).
>   3. Có field của Task 3 nhưng `customers.length !== 1` (bao gồm cả `customers.length === 0` hoặc `customers.length > 1`) -> Ném lỗi:
>      `new MedusaError(MedusaError.Types.INVALID_DATA, "Cannot assign single-customer additional_data to multiple customers in batch.")`.
>   4. Khi ném lỗi, Workflow dừng lại và `createCustomersStep` kích hoạt compensation xóa sạch các customers vừa tạo.
>   5. `customers.length === 1` -> Tiến hành cập nhật metadata tối thiểu với inferred type `CustomerAdditionalData` (chỉ chứa các key thực sự được cung cấp, không truyền key undefined).

> [!IMPORTANT]
> **Quyết định 2: Đơn Nhất Nguồn Chân Lý & Thông Báo Lỗi Ổn Định**
> - Tách schema dùng chung ra file độc lập: `src/utils/customer-additional-data.ts`.
> - Export `customerAdditionalDataSchema` và kiểu `CustomerAdditionalData`.
> - `src/api/middlewares.ts` tái sử dụng `customerAdditionalDataSchema.shape` (Workflow không import ngược từ API layer).
> - Hook sử dụng `customerAdditionalDataSchema.safeParse`. Nếu client gửi field Task 3 sai format, từ chối toàn bộ thao tác bằng message ổn định:
>   `new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid Task 3 customer additional data.")`.

> [!IMPORTANT]
> **Quyết định 3: Tách Biệt Handler Khỏi Registration File & Type-Safety Tuyệt Đối**
> - Sử dụng context type chuẩn của Workflow SDK: `StepExecutionContext` từ `@medusajs/framework/workflows-sdk`.
> - Sử dụng kiểu `CustomerAdditionalData` được suy luận từ Zod cho biến `extraData` để ngăn ngừa vô tình thêm trường ngoài contract.
> - Cấu trúc file tách rời:
>   ```text
>   src/workflows/hooks/
>   ├── customer-created.ts                    # Chỉ làm hook registration
>   ├── handlers/
>   │   └── handle-customers-created.ts        # Isolated/testable hook handler
>   └── __tests__/
>       └── handle-customers-created.unit.spec.ts # Unit test chỉ import handler
>   ```
> - Tránh hoàn toàn side effect đăng ký trùng lặp hook khi Jest chạy module isolation / resetModules.

> [!IMPORTANT]
> **Quyết định 4: Trả về `StepResponse` & Quyết định Compensation**
> - Hook handler luôn trả về `new StepResponse()`.
> - **Lý do compensation:** Không đăng ký custom compensation handler; Workflow SDK sử dụng default no-op. Đây là quyết định kiến trúc có chủ đích vì `createCustomersStep` (step trước hook) đã đảm nhận việc hard-delete toàn bộ các customer vừa tạo nếu workflow gặp lỗi ở bất kỳ bước nào phía sau.

> [!IMPORTANT]
> **Quyết định 5: Tận dụng `mergeMetadata` của Medusa v2.20.1 & Làm Rõ Phạm Vi Unset**
> - Hook chỉ truyền patch dữ liệu mới `{ metadata: extraData }` xuống `customerModuleService.updateCustomers`.
> - `MedusaInternalService` tự động thực hiện `mergeMetadata`, giữ nguyên metadata cũ.
> - **Làm rõ về Unset:** Mặc dù `mergeMetadata` của Medusa hỗ trợ xóa key bằng chuỗi rỗng `""`, contract hiện tại của Task 3 áp dụng cho luồng tạo mới (create customer) nên schema từ chối chuỗi rỗng (yêu cầu regex số cho Zalo ID và URL hợp lệ). Do đó, Task 3 không cung cấp chức năng unset metadata; tính năng này dành cho luồng update chuyên biệt sau này.

> [!IMPORTANT]
> **Quyết định 6: Mô tả Event Emission Chính xác**
> - `customerModuleService.updateCustomers` được gắn decorator `@EmitEvents()` tại `customer-module.ts:179` nên vẫn phát lifecycle event ở cấp độ module (`customer.updated`).
> - Việc gọi trực tiếp module service giúp tránh kích hoạt toàn bộ `updateCustomersWorkflow`, tránh gọi lại hook `customersUpdated` và tránh các workflow-level events không cần thiết.

---

## 3. Phân Tích 12 Bước Chuẩn Staff Engineer khi Nhận Task

### [1] Understand Requirement (Phân tích Yêu cầu)
- **Tác nhân (Actor):** Quản trị viên thao tác qua Medusa Admin Dashboard hoặc REST client.
- **Trường hợp sử dụng (Use Case):** Tạo Customer mới kèm theo các thuộc tính mở rộng (`zalo_id`, `avatar_url`). Hệ thống phải lưu an toàn vào `metadata`.
- **Đầu vào (Input):** 
  - `customers: CustomerDTO[]`.
  - `additional_data: Record<string, unknown> | undefined`.
- **Đầu ra (Output):** Khách hàng trong PostgreSQL có metadata được cập nhật. Route handler `POST /admin/customers` gọi `refetchCustomer` trả về đầy đủ metadata.
- **Quy tắc Nghiệp vụ (Business Rules):**
  - Validation schema nghiêm ngặt: `zalo_id` là chuỗi số 8-20 ký tự, `avatar_url` là URL http/https hợp lệ.
  - Phạt lỗi dứt khoát: Batch chứa dữ liệu Task 3 bị từ chối bằng `MedusaError.Types.INVALID_DATA`. Payload sai định dạng bị reject toàn bộ với thông điệp ổn định.
- **Tác dụng phụ (Side Effects):** Cập nhật `metadata` trong bảng `customer`, phát ra module lifecycle event `customer.updated`.
- **Kịch bản Thất bại (Failure Scenarios):** Hook ném `MedusaError` -> Kích hoạt compensation của `createCustomersStep` -> Xóa sạch các customer vừa tạo trong DB.

### [2] Inspect Existing Capabilities (Kiểm tra Tài nguyên có sẵn)
- `createCustomersWorkflow.hooks.customersCreated` đã có sẵn trong `@medusajs/medusa/core-flows`.
- Route handler `POST /admin/customers` đã truyền `additional_data` và refetch dữ liệu sau workflow.
- `MedusaInternalService` đã có `mergeMetadata`.
- Không cần sửa code core hay tạo route mới.

### [3] Decide Boundary (Thiết kế Ranh giới Module)
- Nằm trọn vẹn trong Customer Module thông qua trường `metadata`.

### [4] Storage Strategy (Chiến lược Lưu trữ)
- Sử dụng cột `metadata` (JSONB) trên entity `Customer`. Truyền patch `{ metadata: extraData }` với kiểu `CustomerAdditionalData` để framework tự merge.

### [5] Module Registration (Đăng ký Module)
- Module lõi đã đăng ký mặc định. Không sửa `medusa-config.ts`.

### [6] Design Persistence (Mô tả Persistence)
- Cột `metadata` đã có sẵn. Không cần sinh migration (`db:generate`/`db:migrate`).

### [7] Design Business Flow (Thiết kế Luồng Nghiệp vụ & DAG)
- File hook đăng ký tại `src/workflows/hooks/customer-created.ts`, tự động được `WorkflowLoader` phát hiện.
- Handler nghiệp vụ tách riêng tại `src/workflows/hooks/handlers/handle-customers-created.ts`.
- Sơ đồ xử lý:
  ```text
  Client POST /admin/customers (kèm adminHeaders)
        |
        v
  Middleware validate qua customerAdditionalDataSchema.shape
        |
        v
  createCustomersWorkflow.run()
        |
        +---> Step 1: createCustomersStep (Insert DB)
        |
        +---> Hook: customersCreated -> handleCustomersCreated
        |       |
        |       +---> Parse additional_data qua customerAdditionalDataSchema
        |       |     - Sai format -> throw MedusaError(INVALID_DATA, "Invalid Task 3 customer additional data.")
        |       |
        |       +---> Kiểm tra Task 3 fields:
        |       |     - Không có -> return new StepResponse() (No-op an toàn)
        |       |     - Có field nhưng customers.length !== 1 -> throw MedusaError(INVALID_DATA, ...)
        |       |
        |       +---> Resolve Modules.CUSTOMER
        |       +---> Xây dựng extraData: CustomerAdditionalData tối thiểu
        |       +---> updateCustomers(customer.id, { metadata: extraData }) (Gọi 1 lần duy nhất)
        |       +---> return new StepResponse()
        |
        +---> Step 2: emitEventStep (Emit 'customer.created' cho Task 1)
        |
        v
  Route Handler: refetchCustomer (Đọc lại bản ghi đã có metadata)
        |
        v
  HTTP 200 Response trả về cho Admin
  ```

### [8] Transaction & Rollback Design (Giao dịch & Rollback)
- Lỗi từ hook làm workflow fail -> Saga compensation của `createCustomersStep` tự động xóa các customer vừa tạo trong DB.

### [9] Step vs Subscriber Split (Phân định Đồng bộ vs Bất đồng bộ)
- Hook chạy đồng bộ (In-band Execution) đảm bảo `refetchCustomer` đọc được metadata ngay lập tức.

### [10] Design API Contract & Scopes (Thiết kế Contract & Scopes)
- Dùng `container.resolve(Modules.CUSTOMER)` với context type `StepExecutionContext`.
- Single source of truth validator bảo vệ cả HTTP layer lẫn workflow invocation trực tiếp.

### [11] Admin UI Extension (Tiền đề cho UI)
- Chuẩn bị metadata nhất quán cho Task 4 Widget `customer.details`.

### [12] Test 3 Tầng & Review (Kế hoạch Kiểm thử)
- Unit Test cho `handleCustomersCreated` độc lập, bao phủ toàn bộ edge cases.
- HTTP Integration Test cho `POST /admin/customers` kèm setup Admin User và cơ chế cleanup qua `try/finally`.
- Kiểm chứng Rollback bằng batch rejection case: Query mảng 2 emails khẳng định kết quả rỗng `[]`.

---

## 4. Thiết Kế Chi Tiết Triển Khai (Zen Code Style)

### 4.1. Shared Schema: `src/utils/customer-additional-data.ts`

```typescript
import { z } from "@medusajs/framework/zod";

// Shared contract for customer additional data | Hợp đồng dùng chung cho dữ liệu mở rộng khách hàng
// Định nghĩa schema kiểm thực tập trung cho cả tầng API Middleware và Workflow Hook
// Enforces validation boundary across HTTP middleware and direct workflow invocations
export const customerAdditionalDataSchema = z.object({

  // Zalo UID format: 8 to 20 numeric digits | Định dạng Zalo UID: chuỗi từ 8 đến 20 chữ số
  // Ràng buộc định dạng tài khoản Zalo hợp lệ theo chuẩn số
  // Strict numeric length constraint preventing invalid third-party identifiers
  zalo_id: z.string()
    .regex(/^[0-9]{8,20}$/, "Zalo ID must be a numeric string of 8 to 20 digits")
    .optional(),

  // Avatar URL protocol restriction: http/https only | Giới hạn giao thức URL: chấp nhận http/https
  // Thu hẹp protocol hợp lệ nhằm loại bỏ các URI scheme nguy hiểm (javascript:, file:, ftp:)
  // Restricts allowed URL protocols to prevent unauthorized URI schemes
  avatar_url: z.url({ protocol: /^https?$/ })
    .optional(),

});

export type CustomerAdditionalData = z.infer<typeof customerAdditionalDataSchema>;
```

### 4.2. Cập Nhật Middleware: `src/api/middlewares.ts`

```typescript
import { defineMiddlewares } from "@medusajs/framework";
import { customerAdditionalDataSchema } from "../utils/customer-additional-data";

// Re-export validator shape for route middleware | Tái sử dụng shape từ schema dùng chung
// Tránh định nghĩa trùng lặp logic kiểm thực giữa tầng Middleware và Workflow
// Bridges shared schema shape to Medusa route-level additionalDataValidator contract
export const adminCreateCustomerAdditionalDataValidator = customerAdditionalDataSchema.shape;

// noinspection JSUnusedGlobalSymbols
export default defineMiddlewares({
  routes: [
    {
      methods: ["POST"],
      matcher: "/admin/customers",
      additionalDataValidator: adminCreateCustomerAdditionalDataValidator,
    },
  ],
});
```

### 4.3. Isolated/Testable Hook Handler: `src/workflows/hooks/handlers/handle-customers-created.ts`

```typescript
import { StepResponse, type StepExecutionContext } from "@medusajs/framework/workflows-sdk";
import { Modules, MedusaError } from "@medusajs/framework/utils";
import type { ICustomerModuleService, CustomerDTO } from "@medusajs/framework/types";
import {
  customerAdditionalDataSchema,
  type CustomerAdditionalData,
} from "../../../utils/customer-additional-data";

export type CustomersCreatedHookInput = {
  customers: CustomerDTO[];
  additional_data?: Record<string, unknown>;
};

// Isolated hook handler for customersCreated | Hàm xử lý tách rời cho hook customersCreated
// Tách riêng khỏi file đăng ký để cho phép unit test độc lập không gây side-effect
// Separated from registration file to allow direct unit testing without workflow side effects
export async function handleCustomersCreated(
  {
    customers,
    additional_data,
  }: CustomersCreatedHookInput,
  { container }: StepExecutionContext,
): Promise<StepResponse<void>> {

  // 1. Guard clause: Skip execution when additional_data is absent | Bỏ qua khi không có additional_data
  // Bỏ qua an toàn cho các luồng tạo chuẩn không kèm payload mở rộng
  // Safe no-op for standard creation flows without extra payloads
  if (!additional_data || typeof additional_data !== "object") {

    return new StepResponse();

  }

  // 2. Validate payload at the workflow boundary | Xác thực dữ liệu tại ranh giới workflow
  // Xác thực lại tại đây bảo toàn hợp đồng dữ liệu kể cả khi gọi ngoài middleware HTTP
  // Re-validating guarantees contract integrity even if invoked outside HTTP middleware
  const parseResult = customerAdditionalDataSchema.safeParse(additional_data);

  if (!parseResult.success) {

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Invalid Task 3 customer additional data.",
    );

  }

  const { zalo_id, avatar_url } = parseResult.data;

  const hasTask3Fields = zalo_id !== undefined || avatar_url !== undefined;

  // 3. Skip when no Task 3 specific fields are provided | Bỏ qua khi không chứa trường của Task 3
  // Cho phép các tác vụ batch chứa additional_data của module khác tiếp tục mà không bị lỗi
  // Allows batch operations containing unrelated additional_data to proceed without failure
  if (!hasTask3Fields) {

    return new StepResponse();

  }

  // 4. Guard single customer contract for personal data | Bảo vệ hợp đồng đơn khách hàng cho dữ liệu cá nhân
  // Từ chối tạo batch customer hoặc rỗng để ngăn chặn việc gán trùng hoặc sai dữ liệu cá nhân
  // Reject non-single customer creation to prevent assigning identical personal data to multiple records
  if (customers.length !== 1) {

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Cannot assign single-customer additional_data to ${customers.length} customers in batch.`,
    );

  }

  // 5. Build minimal typed metadata patch | Xây dựng patch metadata kiểu chặt chẽ
  // Chỉ truyền các trường thực sự có giá trị, đảm bảo type-safety với CustomerAdditionalData
  // Transmit only defined fields ensuring strict contract type-safety
  const extraData: CustomerAdditionalData = {};

  if (zalo_id !== undefined) {

    extraData.zalo_id = zalo_id;

  }

  if (avatar_url !== undefined) {

    extraData.avatar_url = avatar_url;

  }

  // 6. Persist metadata via CustomerModuleService | Lưu metadata qua CustomerModuleService
  // Gọi trực tiếp module service để cập nhật metadata một lần duy nhất cho đúng customer ID
  // Update customer record directly via isolated module service for the targeted customer ID
  const customerModuleService: ICustomerModuleService = container.resolve(Modules.CUSTOMER);

  await customerModuleService.updateCustomers(customers[0].id, {
    metadata: extraData,
  });

  // 7. Return StepResponse | Trả về StepResponse
  // Tận dụng compensation no-op mặc định của SDK: createCustomersStep sẽ xóa hẳn customer khi rollback
  // Default no-op compensation is utilized: createCustomersStep hard-deletes the customer on rollback
  return new StepResponse();

}
```

### 4.4. Hook Registration: `src/workflows/hooks/customer-created.ts`

```typescript
import { createCustomersWorkflow } from "@medusajs/medusa/core-flows";
import { handleCustomersCreated } from "./handlers/handle-customers-created";

// Register hook consumer into createCustomersWorkflow | Đăng ký hook consumer vào createCustomersWorkflow
// Tự động được phát hiện và nạp bởi WorkflowLoader của Medusa khi server khởi động
// Discovered and loaded automatically by Medusa WorkflowLoader at server startup
createCustomersWorkflow.hooks.customersCreated(handleCustomersCreated);
```

---

## 5. Danh Sách File Triển Khai (Proposed Changes)

### Tầng Tiện Ích Chung (`src/utils`)

#### [NEW] [customer-additional-data.ts](file:///home/ubuntu/Data_D/SmartOSC/project/backend/nodejs/medusa-core-lab/my-medusa-store/apps/backend/src/utils/customer-additional-data.ts)
- Nơi định nghĩa duy nhất `customerAdditionalDataSchema` và kiểu `CustomerAdditionalData`.

### Tầng API Middleware (`src/api`)

#### [MODIFY] [middlewares.ts](file:///home/ubuntu/Data_D/SmartOSC/project/backend/nodejs/medusa-core-lab/my-medusa-store/apps/backend/src/api/middlewares.ts)
- Thay thế inline Zod validator bằng `customerAdditionalDataSchema.shape` từ `src/utils/customer-additional-data.ts`.

#### [MODIFY] [middlewares.unit.spec.ts](file:///home/ubuntu/Data_D/SmartOSC/project/backend/nodejs/medusa-core-lab/my-medusa-store/apps/backend/src/api/__tests__/middlewares.unit.spec.ts)
- Đảm bảo kiểm thử middleware tiếp tục pass 7/7 test cases hiện có.

### Tầng Workflows (`src/workflows`)

#### [NEW] [customer-created.ts](file:///home/ubuntu/Data_D/SmartOSC/project/backend/nodejs/medusa-core-lab/my-medusa-store/apps/backend/src/workflows/hooks/customer-created.ts)
- File đăng ký hook vào `createCustomersWorkflow.hooks.customersCreated`.

#### [NEW] [handle-customers-created.ts](file:///home/ubuntu/Data_D/SmartOSC/project/backend/nodejs/medusa-core-lab/my-medusa-store/apps/backend/src/workflows/hooks/handlers/handle-customers-created.ts)
- Isolated/testable handler export `handleCustomersCreated`, nhận `StepExecutionContext`, validate schema, enforce batch guard, gọi `updateCustomers` đúng 1 lần với patch kiểu `CustomerAdditionalData`, trả `StepResponse()`.

#### [NEW] [handle-customers-created.unit.spec.ts](file:///home/ubuntu/Data_D/SmartOSC/project/backend/nodejs/medusa-core-lab/my-medusa-store/apps/backend/src/workflows/hooks/__tests__/handle-customers-created.unit.spec.ts)
- Bộ Unit Test kiểm thử trực tiếp `handleCustomersCreated` với mock container:
  1. **Happy path:** Cập nhật thành công `zalo_id` và `avatar_url` (gọi `updateCustomers` đúng 1 lần với đúng `customer.id`).
  2. **Minimal metadata patch:** Khi chỉ có `zalo_id`, patch metadata truyền xuống chỉ chứa `{ zalo_id }`, không chứa `avatar_url: undefined`.
  3. **No-op an toàn:** Khi `additional_data` là undefined hoặc object rỗng.
  4. **Batch unrelated additional_data:** Batch nhiều customers nhưng `additional_data` chỉ chứa trường khác (không có `zalo_id`/`avatar_url`) -> no-op, không throw.
  5. **Invalid format rejection:** Ném `MedusaError(INVALID_DATA, "Invalid Task 3 customer additional data.")` khi field Task 3 sai format.
  6. **Empty customers rejection:** `customers = []` nhưng có field Task 3 -> ném `INVALID_DATA`.
  7. **Batch Task 3 rejection:** `customers.length > 1` có kèm field Task 3 -> ném `INVALID_DATA`.
  8. **Error Propagation:** Lan truyền exception khi `customerModuleService.updateCustomers` gặp lỗi.

### Tầng Integration Tests (`integration-tests/http`)

#### [NEW] [customer-additional-data.spec.ts](file:///home/ubuntu/Data_D/SmartOSC/project/backend/nodejs/medusa-core-lab/my-medusa-store/apps/backend/integration-tests/http/customer-additional-data.spec.ts)
- Kiểm thử tích hợp HTTP sử dụng `medusaIntegrationTestRunner`:
  - **Prerequisite:** PostgreSQL test database đang hoạt động.
  - **Setup:** Khởi tạo admin user bằng `createAdminUser` và thiết lập `adminHeaders`.
  - **Test Case 1 (Persist & Merge + Cleanup via try/finally):**
    - Gửi `POST /admin/customers` kèm email ngẫu nhiên (`customer_${randomUUID()}@example.com`), metadata `{ source: "pos" }` và `additional_data: { zalo_id: "12345678", avatar_url: "https://example.com/avatar.png" }`.
    - Dùng khối `try/finally` để đảm bảo lệnh cleanup (`customerModuleService.deleteCustomers([createdCustomerId])`) luôn được chạy kể cả khi assertion thất bại.
    - Assert HTTP 200 có đủ `source`, `zalo_id`, `avatar_url`.
  - **Test Case 2 (Rollback Verification):**
    - Khởi chạy trực tiếp workflow:
      ```typescript
      await createCustomersWorkflow(container).run({
        input: {
          customersData: [
            { email: `customer_${randomUUID()}@example.com` },
            { email: `customer_${randomUUID()}@example.com` },
          ],
          additional_data: {
            zalo_id: "12345678",
          },
        },
      });
      ```
    - Assert workflow promise reject với `MedusaError.Types.INVALID_DATA`.
    - Query `customerModuleService.listCustomers({ email: [email1, email2] })` và assert kết quả trả về là mảng rỗng `[]` (chứng minh core compensation đã hard-delete sạch sẽ).

---

## 6. Kế Hoạch Kiểm Thử Hoàn Chỉnh (Verification Gate)

```bash
cd my-medusa-store/apps/backend

# 1. Chạy riêng Unit Test của Task 3
pnpm run test:unit -- src/workflows/hooks/__tests__/handle-customers-created.unit.spec.ts

# 2. Chạy toàn bộ Unit Tests hồi quy (Task 1, Task 2, Task 3)
pnpm run test:unit

# 3. Chạy HTTP Integration Test (Xác nhận persist metadata và rollback compensation)
pnpm run test:integration:http -- customer-additional-data.spec.ts

# 4. Kiểm tra Linter
pnpm run lint

# 5. Build kiểm tra kiểu và alias
pnpm run build
```
