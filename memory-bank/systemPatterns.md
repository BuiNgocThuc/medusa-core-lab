# System Patterns

## Architecture
- **Medusa v2 Workspace:** Su dung Turborepo de quan ly mono-repo (Backend + Storefront).
- **File-based Routing:** Cac API Routes duoc dinh nghia dua tren cau truc thu muc (`src/api/...`).
- **Data Modeling Language (DML):** Su dung DML thay cho TypeORM de dinh nghia Schema.
- **Workflows:** Su dung he thong Workflow (Saga pattern) cua Medusa cho cac luong logic phuc tap, dam bao tinh nhat quan du lieu (Rollback khi co loi).

## Technical Decisions
- **Dockerized Infrastructure:** Su dung `docker-compose` de quan ly rieng re PostgreSQL (port 5434 - `medusa_core_lab_db`) va Redis (port 6381 - `medusa_core_lab_redis`), chay Backend tren port 9000 va Storefront tren port 8000.
- **Package Manager:** Dung `pnpm` workspace chuan.
- **Custom AI Tooling:** Tich hop `Portable Agent Kit` de bao ve ma nguon (Guard System), cung cap Workflows va quy dinh (Rules) code chuyen biet cho Medusa/Node.js.
- **AI-Assisted Development Stack:** Ket hop MCP Server (`medusa_core_lab_db` port 5434, `medusa-docs` schema context) cung Plugin `medusa-dev` (7 skills cung cap code generator, architectural rules va anti-pattern prevention) theo workflow 6 buoc (Think -> Ask -> Code -> Validate -> DB -> Test).

## Component Relationships & Module Links
- `Storefront (Next.js)` --> `Backend API (Cong 9000)` (Xac thuc qua Publishable Key).
- `Payment Module` <--> `Module Link (customer_account_holder)` <--> `Customer Module` (Luu Stripe Customer ID/AccountHolder).
- `Auth Module` <--> `Logical Link (app_metadata.customer_id)` <--> `Customer Module` (Khong sinh bang pivot; nhieu `AuthIdentity` doc lap co the cung tro ve mot `Customer`).
- `Cart / Order` bam vao `Customer` qua `customer_id` (Read-only link).
- `Promotion` tuong tac voi `Customer` qua `customer_group_id` (Decoupled: Workflow truyen danh sach Group IDs vao Promotion Rule Engine luc tinh gio hang, khong co Foreign Key truc tiep giua 2 module).
- `Custom Loyalty Module` <--> `Module Link (Stored Link)` <--> `Customer Module` (Mo hinh Hybrid Reference: `LoyaltyAccount` luu truc tiep `customer_id` unique tren bang du lieu kem stored link table phuc vu Query Graph 2 chieu ma khong tao Foreign Key xuyen module).

## Customer Module Data & Security Patterns
- **5 Tables Architecture:**
  - `customer`: Bang trung tam luu tru danh ba, ho ten, email, phone, metadata (JSONB).
  - `customer_address`: 1 Customer co nhieu Address, phan biet bang co `is_default_shipping` / `is_default_billing`.
  - `customer_group`: Nhom khach hang (VIP, Wholesaler,...).
  - `customer_group_customer`: Bang trung gian N-N lien ket Customer va Group.
  - `customer_account_holder`: Bang Module Link trung gian lien ket Customer va Payment AccountHolder.
- **Compound Unique Index:** `IDX_customer_email_has_account_unique` tren `(email, has_account) WHERE (deleted_at IS NULL)`. Cho phep 1 Guest va 1 Registered ton tai song song cung email, nhung khong cho phep 2 Guest hoac 2 Registered trung email.
- **DTO Immutability Pattern (`has_account`):**
  - `has_account` co mat trong `CreateCustomerDTO` nhung hoan toan vang mat trong `UpdateCustomerDTO` va `CustomerUpdatableFields`.
  - Public service `customerModuleService.updateCustomers` khong cho phep cap nhat `has_account`.
  - Do do, viec nang cap Guest tai cho (in-place upgrade) la customization nam ngoai public contract, can thiep entity internal hoac DB truc tiep.
- **Storefront 2-Step Registration & Actorless Token Pattern:**
  - *Phase 1 (Identity Creation):* Client goi `POST /auth/customer/emailpass/register` -> Auth Module tao `auth_identity` voi `app_metadata` rong (`customer_id: null`) va cap Actorless JWT token (`allowUnregistered: true`).
  - *Phase 2 (Customer Creation):* Client gui Actorless JWT kem payload sang `POST /store/customers` -> `createCustomerAccountWorkflow` kiem tra danh tinh, tao ban ghi `customer` va goi `setAuthAppMetadataStep` de ghi `app_metadata.customer_id = customer.id`.
  - *Phase 3 (Token Refresh):* Client gui token ban dau toi `POST /auth/token/refresh` -> Auth Module doc lai `app_metadata` da cap nhat va cap phat JWT moi chua `actor_id` (`customer_id`) de truy cap cac route yeu cau danh tinh khach hang day du.
- **Production Account Reconciliation & Order Transfer Pattern:**
  - Khi Guest dang ky tai khoan moi hoac dang nhap lan dau qua Social Auth: He thong tao Registered Customer moi thong qua `createCustomerAccountWorkflow`.
  - Hai ban ghi (Guest va Registered) ton tai song song hop le nho Partial Unique Index.
  - Chuyen giao don hang tu Guest sang Registered duoc thuc hien tach biet qua cap workflow chuan cua Medusa: `requestOrderTransferWorkflow` (phat token) -> `acceptOrderTransferWorkflow` (xac nhan token va chuyen quyen so huu don hang).
- **Multi-Identity Link Pattern (Auth Module):**
  - Auth Module quan ly `auth_identity` va `provider_identity` (`auth_identity.provider_identities`).
  - Khi nguoi dung lien ket mot provider moi (vi du Google khi da co Email/Password), provider tao ra mot `AuthIdentity` moi voi `app_metadata` rong.
  - Workflow lien ket danh tinh thiet lap: `new_auth_identity.app_metadata.customer_id = existing_customer.id`.
  - Sau khi lien ket, client goi `POST /auth/token/refresh` de nhan JWT bearer token moi mang `actor_id` (`customer_id`).
- **Safe 4-Step Saga Workflow Pattern (Loyalty & Compensation):**
  - *Step 1 (Validate):* Kiem tra dieu kien eligibility.
  - *Step 2 (Claim / Idempotency):* Ghi nhan ban ghi claim/ledger voi persistent database unique constraint `UNIQUE(customer_id, reward_type, source_id)`. Neu co 2 request dong thoi, request thua race se bi chan ngay tai day truoc khi cham vao so du.
  - *Step 3 (Atomic Increment):* Cong diem vao Loyalty Module.
  - *Step 4 (Inject Failure / Complete):* Kiem chung compensation rollback (Step 3 atomic decrement delta, Step 2 xoa/reverse claim).
- **Extension Triad & API Boundary Pattern:**
  - *Admin API (`POST /admin/customers`):* Boc qua `WithAdditionalData`, cho phep nhan `additional_data` va kiem tra schema qua `additionalDataValidator` tai `src/api/middlewares.ts`.
  - *Single Source of Truth Schema:* Tuyen bo `customerAdditionalDataSchema` tai `src/utils/customer-additional-data.ts` dung chung cho ca API Middleware va Workflow Hook, loai bo logic validation trung lap va tranh circular dependency.
  - *Middleware Validation Pattern:* Su dung Zod v4 voi method chaining (`z.string().regex(...)`, `z.url({ protocol: /^https?$/ })`) de xac thuc `additional_data`, dong thoi tan dung co che mac dinh cua Zod de tu dong loai bo truong ngoai khai bao (stripping unknown keys) chong injection payload.
  - *Workflow Hook (`src/workflows/hooks/*`):* Chay in-flight trong luong Saga voi `StepResponse` va Compensation Step; danh rieng cho tac vu Reversible.
    - *Isolated Handler:* Tach file dang ky (`customer-created.ts`) khoi file thuc thi (`handlers/handle-customers-created.ts`) de unit test doc lap ma khong gay side-effect dang ky duplicate hook.
    - *Batch Safety Contract:* Chi chap nhan gan du lieu ca nhan khi `customers.length === 1`. Bat buoc throw `MedusaError(INVALID_DATA)` neu `customers.length !== 1` kem payload Task 3 de kich hoat rollback compensation cua `createCustomersStep` xoa sach records vua tao.
    - *Minimal Metadata Patching & mergeMetadata:* Chi truyen cac truong thuc su co gia tri xuong `customerModuleService.updateCustomers` de tan dung tinh nang `mergeMetadata` cua Medusa v2.20.1 ma khong ghi de metadata cu hoac trigger cascade workflow events.
  - *Black-Box Testing & Runner Guard Pattern:* Bo test suite Bruno API (`bruno/`) su dung chot chan `if (req.getExecutionMode() === "runner") { bru.runner.skipRequest(); }` de tu dong bo qua cac request DELETE khi chay Runner tu dong, chi thuc thi khi bam nut Send thu cong.
  - *Storefront API (`POST /store/customers`):* Dung `StoreCreateCustomer`, khong nhan `additional_data`. Storefront truyen du lieu tuy bien qua `metadata` hoac tao custom Store route + workflow neu can contract chat che.
  - *Event Subscriber (`src/subscribers/*`):* Chay ngam async sau khi DB commit; danh rieng cho tac vu Irreversible (Email, SMS, thong bao).
  - *Admin Dashboard UI Widget Pattern (`src/admin/widgets/*`):*
    - *Discovery & Registration:* Vite bundler (`@medusajs/admin-vite-plugin`) tu dong crawl thu muc `src/admin/widgets/**/*.tsx`, trich xuat `export const config = defineWidgetConfig({ zone: "customer.details" })` va nap component `export default` vao `DashboardApp.populateWidgets`.
    - *Layout Composer Handshake:* Core dashboard tai `customer-detail.tsx` goi `<LayoutComposer widgetsZonePrefix="customer.details" data={customer} />`, tu dong khop prefix voi widget zone va truyen prop `data` kieu `DetailWidgetProps<HttpTypes.AdminCustomer>`.
    - *Defensive UI Fallback:* Widget trien khai cac ham helper doc lap (`parseHttpUrl`, `getValidZaloId`, `getCustomerInitials`) de xu ly phong thu da tang: tu dong fallback ve Initials khi URL anh loi 404 hoac metadata rong; chan du lieu xau ma khong lam vo layout hay giat man hinh; dong bo toan dien voi he thong component `@medusajs/ui` trong ca hai che do Light va Dark mode.
- **2-Layer Defense Pattern (Default Address):**
  - *Layer 1 (Application Workflow):* Step `maybeUnsetDefaultShippingAddressesStep` tu dong tim va go co `false` cho cac dia chi cu khi them/sua dia chi mac dinh moi.
  - *Layer 2 (PostgreSQL Index):* `IDX_customer_address_unique_customer_shipping/billing` (`UNIQUE(customer_id) WHERE is_default_... = true`) chan dung Race Condition o tang DB.
- **Soft Delete Pattern:** Tat ca cac bang Customer su dung `deleted_at`. Luu y: xoa mem `customer` khong kich hoat `ON DELETE CASCADE` cua PostgreSQL, can chu y tranh PII Leakage o bang con `customer_address`.
- **Custom Loyalty Module & Hybrid Reference Pattern (Task 5):**
  - *Domain Model:* `LoyaltyAccount` dinh nghia tai `src/modules/loyalty/models/loyalty-account.ts` voi `id` (primaryKey), `customer_id` (unique text theo mo hinh Hybrid Reference), `points` (number default 0), `tier` (enum LoyaltyTier BRONZE/SILVER/GOLD default BRONZE).
  - *Module Service Factory:* `LoyaltyModuleService` ke thua dynamic factory `MedusaService({ LoyaltyAccount })` tu dong sinh 8 ham CRUD chuan ma khong can repository boilerplate.
  - *Module Definition:* Export qua `Module("loyalty", { service: LoyaltyModuleService })` de Medusa IoC Container resolve dependency voi module key `camelCase`.
  - *Stored Module Link:* Dinh nghia tai `src/links/customer-loyalty.ts` ket noi `CustomerModule.linkable.customer` va `LoyaltyModule.linkable.loyaltyAccount` cho phep Query Graph `query.graph({ entity: "customer", fields: ["loyalty_account.*"] })`.
