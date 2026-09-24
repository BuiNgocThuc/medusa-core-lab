# Active Context

## Current Focus
Hoan thanh tron ven 100% **Task 5: Custom Loyalty Module & Module Link** theo dung tieu chuan nghiem thu Definition of Done. Chuan bi commit ma nguon va chuyen trong tam sang **Task 6: Multi-Step Saga Workflow with Compensation** (thiet ke transactional workflow voi co che rollback tu dong, tao dong thoi Customer, LoyaltyAccount va Stored Link).

## Recent Changes
- Hoan thanh dang ky module `loyalty` vao `apps/backend/medusa-config.ts` (Buoc 2 cua Task 5).
- Hoan thanh **Buoc 1 cua Task 5: Custom Loyalty Module (Domain & Service Layer)**:
  - Trien khai model `LoyaltyAccount` tai `apps/backend/src/modules/loyalty/models/loyalty-account.ts` voi cac truong `id` (primaryKey), `customer_id` (unique text theo mo hinh Hybrid Reference), `points` (number default 0), `tier` (enum LoyaltyTier BRONZE/SILVER/GOLD default BRONZE).
  - Trien khai service `LoyaltyModuleService` tai `apps/backend/src/modules/loyalty/service.ts` ke thua factory function `MedusaService({ LoyaltyAccount })`.
  - Trien khai module definition tai `apps/backend/src/modules/loyalty/index.ts` export default `Module("loyalty", { service: LoyaltyModuleService })`.
  - Nghien cuu va doi chieu co che van hanh noi bo cua `MedusaService` truc tiep trong `medusa-core-source`:
    - Runtime: `packages/core/utils/src/modules-sdk/medusa-service.ts` (Dynamic prototype injection cho 8 phuong thuc CRUD, tu dong dinh kem cac decorators `@MedusaContext`, `@EmitEvents`, `@InjectManager`).
    - Compile-time: `packages/core/utils/src/modules-sdk/types/medusa-service.ts` (Template Literal Mapped Types tu dong suy dien chu ky ham type-safe theo so it/so nhieu cho IDE autocomplete).
- Hoan thanh thiet ke kien truc & dong bo tai lieu cho **Task 5: Custom Loyalty Module & Module Link**:
  - Chot mo hinh Hybrid Reference: `LoyaltyAccount` model voi `customer_id` (unique), `tier` (enum BRONZE/SILVER/GOLD), `points` (default 0) va Stored Link 1–1 toi Customer Module.
  - Doi chieu ma nguon Medusa Core (`link.ts`, `delete-customers.ts`): Loai bo `deleteCascade` khoi Task 5 vi core khong tu dong cascade custom links khi xoa Customer; xac nhan bang link doc lap khong co Foreign Key xuyen module.
  - Thiet ke bo 6 ca kiem thu tich hop su dung `medusaIntegrationTestRunner` tren runtime Medusa 2.20.1 va script CLI chi doc (`verify-loyalty.ts`) theo hop dong `ExecArgs`.
  - Dong bo hang muc don dep Customer deletion vao pham vi Task 6 tai `LEARNING_PLAN.md` (line 161).
  - Xuat ban tai lieu ky thuat chi tiet len Notion page `Task 5: Triển Khai Loyalty Module & Module Link (Kiến Trúc Hybrid Reference & Stored Link)` (`3dfb526d-69e7-819d-a67d-d916d2dd7161`).
  - Cap nhat task tren LarkSuite Base (`recvvyyuLcss2n`) theo dung triet ly Understated Rigor va Zero-Emoji Policy.
- Hoan thanh tron ven 100% **Task 4: Admin Dashboard UI Widget** (`customer.details`):
  - Trien khai widget component tai `my-medusa-store/apps/backend/src/admin/widgets/customer-extra-details.tsx` gan vao injection zone `customer.details`.
  - Tich hop chat che he thong Medusa UI (`@medusajs/ui`): `Container`, `Heading`, `Text`, `Avatar`, `Badge`, `Copy` tuong thich 100% ca Dark va Light mode.
  - Xay dung 3 ham defensive helpers doc lap: `parseHttpUrl` (validate giao thuc http/https, chiet xuat hostname), `getValidZaloId` (regex 8-20 chu so), `getCustomerInitials` (fallback da tang: Full Name -> First -> Last -> Email -> "?").
  - Loai bo triet de 100% chi thi `@ts-ignore` va type warnings, tuan thu nghiem ngat `noUnusedLocals` va `noUnusedParameters`.
  - Kiem dinh tinh (Static Verification): `tsc --noEmit -p src/admin/tsconfig.json` dat 0 loi; `medusa lint` dat 0 loi tren ma nguon moi.
  - Kiem dinh thuc te (Runtime Verification) tren live Medusa Admin (`http://localhost:9000/app`): Xac thuc truc quan qua trinh duyet tai trang chi tiet khach hang `Nguyen Van A` (`cus_01M2PRBFEAR0KG4TNT1ST0EXRZ`), avatar fallback ve "NV" khi link anh dummy 404, hostname va Zalo ID hien thi chuan kem nut Copy.
  - Doi chieu sau kien truc Core Medusa v2: Lam ro 4 vi tri cot loi tu Vite bundler (`helpers.ts`, `generate-widgets.ts`), `DashboardApp.populateWidgets`, `customer-detail.tsx`, den `LayoutComposer`.
- Hoan thanh tron ven 100% **Task 3: Workflow Hook Customization** va Black-box API Verification:
  - Trien khai hook registration tai `src/workflows/hooks/customer-created.ts` va isolated handler tai `src/workflows/hooks/handlers/handle-customers-created.ts`.
  - Tuyen bo `customerAdditionalDataSchema` tai `src/utils/customer-additional-data.ts` lam Single Source of Truth cho ca Middleware va Hook.
  - Bao ve quy tac Batch: Chi ap dung khi `customers.length === 1`; tu choi dut khoat `customers.length !== 1` bang `MedusaError(INVALID_DATA)` de kich hoat rollback compensation xoa sach ban ghi vua tao.
  - Cap nhat metadata toi thieu qua `customerModuleService.updateCustomers` tan dung `mergeMetadata` cua Medusa v2.20.1 ma khong kich hoat cascade event thua.
  - Bo Unit Tests dat 8/8 pass (`handle-customers-created.unit.spec.ts`), bo HTTP Integration Test dat 2/2 pass (`customer-additional-data.spec.ts`).
  - Xay dung va tinh chinh bo suu tap Bruno Suite (`bruno/`): Tinh chinh 3 test assertions (08 - Zalo format, 09 - URL format, 10 - Duplicate email) khop chuan voi Zod va Medusa v2 core error handler. Xac nhan tren live backend dat **10/10 requests PASS (27/27 assertions PASS)**.
  - Dong bo toan dien trang thai COMPLETED & VERIFIED, kien truc va bang chung kiem thu len Notion page Task 3 va `LEARNING_PLAN.md`.
- Chuan hoa va dong bo tai lieu kien truc Medusa v2 Storefront Registration Flow len Notion:
  - Nghien cuu sau tu repo goc `medusa-core-source` tai commit `da9be14f`: Doi chieu 15 dan chung ma nguon tu `emailpass.ts`, `authenticate-middleware.ts`, `generate-jwt-token.ts`, `create-customer-account.ts`, `set-auth-app-metadata.ts` den `js-sdk`.
  - Cap nhat Trang 1 (`Medusa Customer Module` - `3d54499f-ebfc-809f-9493-e02b69e1f691`): Bo sung Bang doi chieu Admin vs Storefront 3 cot tai Muc 3.1 va Sequence Diagram 4 lan + Mau SDK + Phan tich 3 giai doan tai Muc 4.2.
  - Cap nhat Trang 2 (`Onboarding Guide: MedusaJS` - `3d64499f-ebfc-8155-bb93-e1057d90716c`): Bo sung Callout Box kien truc tai Muc 4.4 tom tat 3 trang thai dinh danh va dan link dieu huong sang Trang 1.
  - Kiem thu hau ki (Post-flight verification): Xac nhan bao toan 100% noi dung cu ngoai pham vi (zero-drift) va tuan thu tuyet doi Zero-Emoji Policy.
- Giai quyet su co GitHub Push Protection va dong bo Git:
  - Dua `.vscode/` va `.antigravitycli/` vao `.gitignore`, loai bo secret token khoi git cache, amend commit sach va push thanh cong branch `feature/MEDUSA-001-extendsion-customer-module` len GitHub.
  - Kiem tra ket noi truc tiep Notion MCP va LarkSuite MCP xac nhan token van an toan, hoat dong binh thuong va khong bi revoke.
- Chuan hoa ha tang local va port mapping:
  - Dong bo port Backend ve `PORT=9000` (tranh xung dot Portainer 9001).
  - Khoi dong Docker compose voi Postgres port `5434` (`medusa_core_lab_db`) va Redis port `6381` (`medusa_core_lab_redis`), tao file `.env` chuan cho Backend va Storefront (port 8000).
  - Thiet lap tai khoan `agents` password `root123` va cau hinh thanh cong MCP Server `medusa_core_lab_db` tren ca 3 tang (Antigravity global, `.agents`, `.vscode`), truy van truc tiep 146 bang du lieu va phan tich query plan.
- Bo sung thanh cong **Chuong 6: DAG Mental Model: 20% Kien Thuc Doc 80% Core-Flows** vao trang Notion Architecture Playbook (`3d64499f-ebfc-8076-b39e-c685ead3185e`), bao toan 100% noi dung 5 chuong cu, render dung table va code block ASCII, tuan thu triet de Zero-Emoji Policy.
- Hoan thanh tron ven **Task 2: Admin Request Validation Middleware**:
  - Trien khai middleware tai `my-medusa-store/apps/backend/src/api/middlewares.ts` mo rong schema `additional_data` cho route `POST /admin/customers`.
  - Ap dung `additionalDataValidator` voi Zod v4: Rang buoc `zalo_id` (regex chuoi 8-20 chu so), `avatar_url` (giao thuc http/https), va co che tu dong loai bo truong ngoai khai bao (stripping unknown keys).
  - Hoan thien bo Unit Tests tai `src/api/__tests__/middlewares.unit.spec.ts` pass 7/7 test cases (du lieu hop le, gia tri bien, URL sai, va tu choi null).
  - Kiem tra toan dien static analysis: `medusa lint` dat 0 lint issues (tuan thu 100% no semicolons, 2 spaces).
  - Commit ma nguon `cefa970` (`feat[TASK-002]:[api]:add admin customer validation middleware and tests`).
- Dong bo bao cao hang ngay ngay 16/09/2026 len LarkSuite Base theo dung chuan muc Understated Rigor va Zero-Emoji:
  - Yesterday: `recvvlr3yhmmV5` (Implement Admin Request Validation Middleware - Completed), `recvvlr4UT0rXG` (Implement Workflow Hook Customization - In Progress).
  - Today: `recvvlr7n7onkk` (Implement Workflow Hook Customization - In Progress).
- Dong bo bao cao hang ngay ngay 15/09/2026 len LarkSuite Base theo dung chuan muc Understated Rigor va Zero-Emoji (Yesterday: `recvvfLcOQYsKL`, Today: `recvvfLfzODiLS`, `recvvhptOC701L`).
- Hoan thanh tron ven **Task 1: Customer Welcome Subscriber**:
  - Trien khai tai `src/subscribers/customer-created.ts` voi co che idempotency key `welcome-customer:{customer_id}:email`.
  - Pass 4/4 unit tests tai `src/subscribers/__tests__/customer-created.unit.spec.ts`.
  - Kiem chung live tren database PostgreSQL `notification` table khi tao khach hang qua Medusa Admin.
  - Commit ma nguon `a67515f` tren branch `main`.
- Chuan hoa toan dien quy trinh va workflow **`/daily-report`**:
  - Cai to file `.agents/workflows/daily-report.md` theo triet ly "Understated Rigor": khong dung danh xung tu phong, cat bo buzzwords, loai bo micro-benchmark dev vo nghia, tuan thu chat che Zero-Emoji Policy.
  - Thiet lap co che Local-First Ground Truth: doc `git log` va `memory-bank/activeContext.md` truoc khi fetch LarkSuite.
  - Dong bo va cap nhat thanh cong 100% (21/21 tasks) tren LarkSuite Base tu ngay 07/09/2026 den 14/09/2026, bao dam su dong nhat, khiem ton va dung chuan muc ky thuat.
- Chuan hoa toan dien tai lieu kien truc **`LEARNING_PLAN.md`** doi chieu source code Medusa v2.20.1:
  - Xac dinh ro API boundary: `POST /admin/customers` ho tro `additional_data` qua `WithAdditionalData`, con `POST /store/customers` chi nhan fields chuan va `metadata`.
  - Chuan hoa mo hinh Auth Module: `auth_identity` va cac `provider_identity` (`auth_identity.provider_identities`); nhieu `AuthIdentity` co the cung tro toi mot `Customer` thong qua `app_metadata.customer_id`.
  - Phat hien gioi han DTO: `has_account` co trong `CreateCustomerDTO` nhung khong co trong `UpdateCustomerDTO` va `CustomerUpdatableFields`. Public service `customerModuleService.updateCustomers` khong ho tro sua `has_account`.
  - Dinh vi kien truc Account Reconciliation chuan: Tao Registered Customer qua `createCustomerAccountWorkflow`, chuyen don qua `requestOrderTransferWorkflow` -> `acceptOrderTransferWorkflow`; coi In-place Upgrade la Research Spike ngoai public contract.
  - Thiet ke luong Saga 4 buoc an toan: (1) Validate -> (2) DB unique claim -> (3) Atomic increment -> (4) Failure injection de rollback.
  - Chuan hoa luong JWT refresh qua `POST /auth/token/refresh` sau khi lien ket identity.
  - Thiet lap bang Evidence of Completion lam verification gate cho 3 cum task.
- Hoan tat cap nhat va lam sach 100% icon/emoji tren ca hai trang Notion (Playbook Customer Welcome Subscriber va Root Onboarding Guide) cung nhu bao cao hang ngay LarkSuite Base.

## Active Decisions
- Tuyet doi tuan thu quy tac khong dung emoji/icon trong code, tai lieu ky thuat, commit messages, Notion va LarkSuite Base.
- Ap dung triet ly "Understated Rigor" cho tat ca cac bao cao ky thuat: dung dung ban chat ky thuat, de ket qua tu chung minh, khong dung danh xung tu phong (Staff/Senior/Enterprise) va khong trich dan so lieu benchmark dev vo nghia.
- Huong toi kien truc chuan san xuat (production-ready): Dung workflow chinh thuc (`createCustomerAccountWorkflow`, `requestOrderTransferWorkflow`, `acceptOrderTransferWorkflow`) thay vi can thiep truc tiep vao database hoac entity internal de sua `has_account`.
- Bao ve idempotency xuyen suot bang rang buoc duy nhat tren database (`UNIQUE constraint`), khong chi dua vao in-memory hoac workflow execution engine.
- Tuan thu Antigravity CLI Delegation Rule: IDE khong tu dong chay cac lenh commit, push, build, test; cung cap CLI task blocks day du de user thuc thi qua terminal ngoai.

## Next Steps
1. Tiep tuc Task 5 - Buoc 2:
   - Dang ky module `loyalty` vao `apps/backend/medusa-config.ts`.
   - Sinh migration cho module `loyalty`: `pnpm exec medusa db:generate loyalty`.
   - Chay migration cap nhat database: `pnpm exec medusa db:migrate`.
2. Task 5 - Buoc 3:
   - Dinh nghia Stored Module Link tai `apps/backend/src/links/customer-loyalty.ts` (`defineLink` giua `CustomerModule.linkable.customer` va `LoyaltyModule.linkable.loyaltyAccount`).
   - Dong bo link table vao PostgreSQL qua `pnpm exec medusa db:migrate`.
3. Task 5 - Buoc 4:
   - Xay dung bo Integration Test tai `apps/backend/src/modules/loyalty/__tests__/link.spec.ts` (6 test cases kiem tra default values, unique customer_id, query.graph, link isolation, 1-1 constraint rejection, va hybrid drift).
4. Task 5 - Buoc 5:
   - Xay dung script CLI `apps/backend/src/scripts/verify-loyalty.ts` tuan thu contract `ExecArgs`.
   - Chay `pnpm exec medusa lint` va `pnpm run build` kiem tra type safety.
5. Ban giao va chuyen tiep sang Task 6 (Saga Workflow).

## Known Issues / Blockers
- Khong co. Cum 1 (Task 1, 2, 3, 4) da hoan thanh 100%, he thong san sang cho Task 5.
