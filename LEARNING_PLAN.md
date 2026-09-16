# Ke hoach Hoc tap & Thuc hanh: Lam chu Medusa Customer Module (v2)

> **Muc tieu Trong tam:** Nghien cuu sau ve **Customer Module** trong MedusaJS v2 (v2.20.1). Hieu ro cau truc du lieu mac dinh, co che cach ly (isolation), muc do anh huong (impact) khi tuong tac voi cac module khac (Auth, Order, Cart), ky thuat mo rong qua Metadata / Custom Module + Module Link, va xu ly toan ven du lieu (Data Integrity) giua Guest va Registered Customer khi trien khai Social Login.
>
> **Cap nhat lan cuoi:** 2026-09-14
> **Trang thai:** Dang thuc thi

---

## 1. Tong quan cac Giai doan (Phases)

| Phase | Noi dung | Trong tam | Trang thai |
|---|---|---|---|
| Phase 1 | Cai dat & Hieu kien truc tong quan | Set up base project, cau hinh Medusa v2 monorepo | [Hoan thanh] |
| Phase 2 | Deep Dive Customer Module Mac dinh | Data models, co che `has_account`, CRUD API | [Chua bat dau] |
| Phase 3 | Tuong tac & Impact voi cac Module khac | Cart, Order, Promotion, Auth Identity mapping | [Chua bat dau] |
| Phase 4 | Mo rong Customer Module (Extend) | Admin API Validation (`additionalDataValidator`), Workflow Hook, Admin Widget | [Chua bat dau] |
| Phase 5 | Custom Module, Module Link & Saga Workflow | Loyalty Module, Module Link, 4-Step Compensation Rollback, DB Idempotency | [Chua bat dau] |
| Phase 6 | Quan ly Tinh trang Tai khoan & Chuyen giao Don | Guest vs Registered, Order Transfer Workflows, Research Spike Upgrade | [Chua bat dau] |
| Phase 7 | Thuc chien: Social Login & Identity Linking | Application-layer orchestration, 3 nhanh OAuth callback, JWT refresh (`/auth/token/refresh`) | [Chua bat dau] |

---

## 2. Customer Module Mac Dinh Co San Nhung Gi?

Customer Module trong Medusa v2 duoc thiet ke doc lap (isolated commerce module), dong vai tro nhu mot danh ba quan ly thong tin khach hang thuan tuy:

1. **Luu thong tin ca nhan (Customer):** `id`, `first_name`, `last_name`, `email`, `phone`, `metadata`, `has_account`, `deleted_at`.
2. **Luu Dia chi (Customer Address):** Mot khach hang co the luu nhieu dia chi giao hang (Shipping) va thanh toan (Billing).
3. **Phan nhom (Customer Group):** Gom khach hang vao cac nhom (vi du: VIP, Wholesale, B2B) phuc vu dinh gia hoac khuyen mai.
4. **Co che phan biet tai khoan (`has_account`):**
   - Khach mua vang lai (Guest checkout): `has_account = false`.
   - Khach co tai khoan da dang ky: `has_account = true`.
5. **Rang buoc tinh toan ven (Partial Unique Index):**
   - Database constraint: `UNIQUE (email, has_account) WHERE deleted_at IS NULL`.
   - Trang thai hop le: Cho phep ton tai dong thoi 1 ban ghi Guest (`has_account = false`) va 1 ban ghi Registered (`has_account = true`) co cung dia chi email.

> [Luu y Quan trong] Customer Module hoan toan KHONG luu password, KHONG chua token session, va KHONG quan ly phuong thuc dang nhap (Google, Facebook, Email/Password). Toan bo trach nhiem xac thuc thuoc ve Auth Module.

---

## 3. Tuong tac va Anh huong (Impact) giua Customer Module voi cac Module khac

Customer Module khong su dung Foreign Key cung toi cac module khac ma ket noi thong qua Module Link hoac tham chieu dinh danh (ID references) duoc dieu phoi boi Workflows:

- **Voi Cart / Order Module:**
  - Khi khach checkout, Cart Module luu `customer_id` cua khach (Guest hoac Registered).
  - Khi Cart hoan tat thanh Order, toan bo thong tin don hang nam tai Order Module va giu tham chieu toi `customer_id`.
  - Customer Module khong truc tiep quan ly don hang; viec tra cuu don hang cua customer duoc giai quyet qua Query Graph (Remote Link).
- **Voi Promotion / Pricing Module:**
  - He thong ap dung khuyen mai hoac gia rieng bang cach lien ket `customer_group` voi Promotion rules hoac Price List rules thong qua Remote Link.
- **Voi Auth Module:**
  - Auth Module quan ly ban ghi `auth_identity` va cac `provider_identity` (quan he mot-nhieu: `auth_identity.provider_identities`).
  - Anh xa giua danh tinh xac thuc va khach hang duoc luu tai `auth_identity.app_metadata.customer_id`.
  - Luong dang ky mac dinh su dung `createCustomerAccountWorkflow`: tao khach hang qua `createCustomersWorkflow` va gan mapping danh tinh qua `setAuthAppMetadataStep`.

---

## 4. Chien luoc Mo rong & Xu ly Du lieu khi Tich hop

Khi nhan yeu cau luu them thong tin (Avatar, Zalo ID, Ngay sinh) hoac tich hop dang nhap Social Login:

### 4.1. Chien luoc Luu tru & API Boundary
- **Dung `metadata` (JSONB):** Phu hop voi cac truong thong tin phu, khong yeu cau foreign key, khong can index phuc tap hoac nghiep vu doc lap (vi du: `avatar_url`, `zalo_id`).
- **Tao Custom Module doc lap + Module Link:** Nen dung khi thong tin co vong doi rieng, can quan ly transaction/schema chat che hoac can nghiep vu chuyen biet (vi du: Loyalty Points, Member Tier, KYC Verification).
- **Phan biet ro API Boundary cho du lieu bo sung (Extend Customer):**
  - **Admin API (`POST /admin/customers`):** Ho tro san co che `WithAdditionalData`, cho phep truyen `additional_data` va ap dung `additionalDataValidator` qua middleware.
  - **Storefront API (`POST /store/customers`):** Su dung schema `StoreCreateCustomer`, khong boc qua `WithAdditionalData` va khong nhan `additional_data`. Neu Storefront can truyen du lieu tuy bien, co 2 lua chon chuan:
    1. Gui truc tiep qua truong `metadata` tren `POST /store/customers`.
    2. Xay dung custom Store API route + custom workflow neu yeu cau kiem soat contract va validation tung truong mot cach nghiem ngat.

### 4.2. Quan ly Trang thai Guest vs Registered & Kien truc Medusa Chuan
1. **Thuc te Public Contract cua Medusa 2.20.1:**
   - Truong `has_account` chi co trong `CreateCustomerDTO`.
   - Truong `has_account` KHONG co trong `UpdateCustomerDTO` va KHONG co trong `CustomerUpdatableFields`.
   - Public service `customerModuleService.updateCustomers` khong ho tro cap nhat `has_account`.
   - Do do, viec cap nhat `has_account = true` truc tiep tren Guest hien co (In-place Upgrade) la mot customization nam ngoai public contract cua Medusa v2, yeu cau can thiep entity noi bo hoac DB truc tiep, co nguy co gay vo tuong thich khi nang cap phien ban.
2. **Kien truc Chuan cua Medusa (Production Recommended Pattern):**
   - Khi khach hang Guest dang ky tai khoan (hoac dang nhap lan dau qua Social Auth) voi cung email:
     `createCustomerAccountWorkflow` se tao mot ban ghi Registered Customer moi (`has_account = true`).
   - Ca hai Customer (1 Guest va 1 Registered) cung email duoc phep ton tai song song hop le nho Partial Unique Index `UNIQUE(email, has_account) WHERE deleted_at IS NULL`.
   - **Chuyen giao don hang (Order Transfer):** Khi co nhu cau nghiep vu gom don tu Guest sang Registered, Medusa cung cap quy trinh Order Transfer chuan (`requestOrderTransferWorkflow` -> `acceptOrderTransferWorkflow`) de chuyen tung don hoac lo don hang co xac minh token quyen so huu, khong can merge tho bao toan bo Customer entity.
3. **Lien ket Phuong thuc Dang nhap Bo sung (Link Additional Auth Provider):**
   - Khi nguoi dung xac thuc voi mot provider moi, provider do tao mot `auth_identity` moi (kem `provider_identity` tuong ung) voi `app_metadata` ban dau rong. Sau khi da xac minh quyen so huu email, workflow dat:
     `new_auth_identity.app_metadata.customer_id = existing_customer.id`
   - Nghia la **nhieu AuthIdentity doc lap khac nhau co the cung tro toi mot Customer**. Tuyet doi khong tu y lay email tu request de ghep vao tai khoan bat ky khi chua xac minh.

---

## 5. Lo trinh 8 Tasks Thuc hanh (Tu Easy den Expert)

```text
Cluster 1: Foundation & Extensions (Easy - Medium)
Task 1 [Easy]       : Customer Welcome Subscriber (Event & Notification)
Task 2 [Easy]       : Admin Request Validation Middleware (additionalDataValidator & Zod)
Task 3 [Medium]     : Workflow Hook Customization (createCustomersWorkflow Hook)
Task 4 [Medium]     : Admin Dashboard Extension (customer.details UI Widget)

Cluster 2: Custom Module & Distributed Transactions (Medium - Hard)
Task 5 [Med-Hard]   : Custom Loyalty Module & Module Link (Data Model, Migration, Link)
Task 6 [Hard]       : Multi-Step Saga Workflow with Compensation (4-Step Rollback & DB Idempotency)

Cluster 3: Identity, Account Reconciliation & Social Auth (Hard - Expert)
Task 7 [Hard]       : Account Reconciliation & Order Transfer (Production Flow & Upgrade Spike)
Task 8 [Expert]     : Social Login & Multi-Identity Orchestration (OAuth Callback, 3 Branches, JWT Refresh)
```

### Chi tiet cac Tasks:

#### Task 1 [Easy] - Customer Welcome Subscriber
- **Muc tieu:** Lang nghe su kien khach hang duoc tao va phat notification chao mung voi tinh chat idempotent.
- **Trang thai:** Da hoan thanh ma nguon tai `src/subscribers/customer-created.ts` va pass 4/4 unit tests.
- **Ghi chu:** Gui email qua provider thuc te va co che retry qua Redis thuoc pham vi integration test / infrastructure setup.

#### Task 2 [Easy] - Admin Request Validation Middleware
- **Muc tieu:** Rang buoc contract va schema validation cho du lieu bo sung (`additional_data`) khi tao Customer qua Admin API.
- **Trang thai:** Da hoan thanh ma nguon tai `src/api/middlewares.ts`, pass 7/7 unit tests tai `src/api/__tests__/middlewares.unit.spec.ts` va pass 0 lint issues (`medusa lint`).
- **Kien truc:** Su dung `additionalDataValidator` voi Zod tu `@medusajs/framework/zod` trong `src/api/middlewares.ts` ap dung cho route `POST /admin/customers`.
- **Dac ta:** Validate `additional_data.zalo_id` (string, regex hop le) va `additional_data.avatar_url` (url hop le).
- **Mo rong:** Nam ro co che truyen metadata truc tiep qua `POST /store/customers` hoac xay dung custom Store route khi can validate chat che o Storefront.

#### Task 3 [Medium] - Workflow Hook Customization
- **Muc tieu:** Xu ly dong bo an toan du lieu bo sung (`additional_data`) vao `metadata` cua khach hang thong qua Workflow Hook voi day du co che kiem soat ranh gioi va transactional rollback.
- **Trang thai:** Da hoan thanh ma nguon tai `src/workflows/hooks/customer-created.ts` va handler doc lap tai `src/workflows/hooks/handlers/handle-customers-created.ts`; pass 8/8 unit tests tai `src/workflows/hooks/__tests__/handle-customers-created.unit.spec.ts`, pass 2/2 HTTP integration tests tai `integration-tests/http/customer-additional-data.spec.ts`, va pass kiem thu Black-box toan dien qua Bruno API Collection (`bruno/`).
- **Kien truc:** Su dung diem neo hook `createCustomersWorkflow.hooks.customersCreated` tu `@medusajs/medusa/core-flows`. Tuyen bo schema dung chung `customerAdditionalDataSchema` tai `src/utils/customer-additional-data.ts` lam Single Source of Truth cho ca Middleware va Hook.
- **Dac ta:**
  - Tach biet hook handler khoi file dang ky de ho tro unit test truc tiep khong gay side-effect dang ky trung lap.
  - Chinh sach Batch an toan: Chi cho phep gan du lieu ca nhan (`zalo_id`, `avatar_url`) khi `customers.length === 1`. Neu `customers.length !== 1` kem du lieu Task 3, tu choi dut khoat bang `MedusaError(INVALID_DATA)` de kich hoat compensation cua `createCustomersStep` xoa sach cac ban ghi vua tao (Rollback Verification).
  - Dong bo toi thieu vao `metadata` qua `customerModuleService.updateCustomers(customer.id, { metadata: extraData })` voi kieu `CustomerAdditionalData`, tan dung tinh nang `mergeMetadata` cua Medusa v2.20.1 de bao toan cac truong metadata cu ma khong kich hoat cascade event khong can thiet.
  - Return `new StepResponse()` tan dung co che compensation no-op mac dinh vi step truoc da dam nhan hard-delete khi rollback.

#### Task 4 [Medium] - Admin Dashboard UI Widget
- **Muc tieu:** Hien thi thong tin mo rong (Avatar, Zalo ID) truc quan tren trang chi tiet khach hang trong Medusa Admin.
- **Kien truc:** Su dung Widget Injection Zone `customer.details` tai `src/admin/widgets/customer-extra-details.tsx`.
- **Dac ta:** Render Avatar image, Zalo ID badge; xu ly fallback an toan khi du lieu metadata bi trong hoac chua co du lieu.

#### Task 5 [Medium - Hard] - Custom Loyalty Module & Module Link
- **Muc tieu:** Xay dung module quan ly diem thuong doc lap theo chuan kien truc Module cua Medusa v2.
- **Kien truc:** 
  - Module `loyalty`: Dinh nghia model `LoyaltyAccount` (point balance, tier) tai `src/modules/loyalty`.
  - Module Link: Dinh nghia lien ket giua `customer` va `loyalty_account` qua `defineLink` tai `src/links/customer-loyalty.ts`.
  - Sinh migration va chay migrate vao co so du lieu PostgreSQL.

#### Task 6 [Hard] - Multi-Step Saga Workflow voi Compensation & DB Idempotency
- **Muc tieu:** Xay dung workflow phuc hop cap diem thuong khi dang ky hoac mua hang, bao dam tinh toan ven theo mo hinh Saga va co che retry an toan.
- **Kien truc:** Dinh nghia custom workflow voi `createStep`, co step thuc thi va compensation function tuong ung.
- **Thiet ke 4 Buoc An toan (Safe Step Order):**
  - **Step 1:** Kiem tra dieu kien nhan thuong (Validate eligibility).
  - **Step 2:** Tao reward claim / ledger entry voi persistent unique constraint tren database:
    `UNIQUE(customer_id, reward_type, source_id)`
    Neu 2 request chay song song, request thua cuoc se bi chan ngay tai buoc nay truoc khi so du bi thay doi.
  - **Step 3:** Atomic increment point balance (cong diem vao Loyalty Module).
  - **Step 4:** Inject loi chu dong de kich hoat compensation rollback ca Step 3 va Step 2.
- **Compensation Logic:**
  - Compensation Step 3: Atomic decrement dung so diem (delta) ma execution nay da cong.
  - Compensation Step 2: Delete / reverse ban ghi claim do execution nay tao ra.
- *(Luu y kien truc: Trong production, mot thiet ke chat che hon nua la gop tao ledger va cap nhat balance vao cung mot SQL transaction noi bo cua Loyalty Module, sau do dung Saga cho cac thao tac xuyen module).*

#### Task 7 [Hard] - Account Reconciliation & Order Transfer
- **Muc tieu:** Nam vung co che quan ly Customer khi Guest dang ky tai khoan, chuyen don hang an toan theo kien truc Medusa chuan, va danh gia gioi han cua in-place upgrade.
- **Kien truc:** 
  - Kiem chung tinh hop le cua Partial Unique Index tren database: 1 Guest va 1 Registered cung email ton tai song song.
  - **Luong Production Mac dinh:** Su dung `createCustomerAccountWorkflow` de tao Registered Customer moi, sau do thuc hien chuyen giao don hang tu Guest sang Registered bang cap workflow: `requestOrderTransferWorkflow` (sinh token chuyen don) -> `acceptOrderTransferWorkflow` (xac nhan token va chuyen quyen so huu don sang customer dich).
  - **Research Spike (Khao sat Chuyen sau):** Khao sat tinh kha thi va gioi han cua In-place Guest Upgrade (khi can thiep entity/DB truc tiep de cap nhat `has_account = true`), danh gia rui ro khi di ra ngoai public contract cua `CustomerUpdatableFields`.
  - Ap dung co che compensation trong workflow de bao ve tinh toan ven giua Customer Module va Auth Module khi xay ra loi.

#### Task 8 [Expert] - Social Login & Multi-Identity Orchestration
- **Muc tieu:** Dieu phoi luong dang nhap mang xa hoi (Google OAuth) o tang Application Layer, xu ly day du 3 nhanh sau callback va thuc hien JWT refresh.
- **Kien truc:**
  - Logic dieu phoi khach hang nam tai Store API / Workflow cua Application Layer, tuyet doi khong dua vao provider implementation.
  - Xu ly 3 nhanh sau khi OAuth callback duoc xac thuc:
    - *Nhanh 1:* `auth_identity` da co `app_metadata.customer_id` -> Dang nhap thang vao Customer hien co.
    - *Nhanh 2:* `auth_identity` chua gan Customer, email chua ton tai -> Goi `createCustomerAccountWorkflow` de tao Customer moi va gan identity mapping.
    - *Nhanh 3:* `auth_identity` chua gan Customer, muon su dung Customer hien co -> Goi workflow lien ket co xac minh quyen so huu (thiet lap `new_auth_identity.app_metadata.customer_id = existing_customer.id`).
  - Sau khi tao hoac lien ket Customer, client goi `POST /auth/token/refresh` de nhan JWT moi chua `actor_id` (`customer_id`).

---

## 6. Bang Tieu chi Hoan thanh (Evidence of Completion)

Tung cum task chi duoc danh gia la dat yeu cau khi vuot qua day du cac tieu chi kiem chung thuc te duoi day:

| Cum Task | Pham vi | Bang chung Hoan thanh Bat buoc (Evidence) |
|---|---|---|
| **Cum 1 (Task 2 - 4)** | Validation, Hook, Widget | - Input sai format gui toi `POST /admin/customers` (Zalo ID khong dung regex, URL hong) bi Middleware chan va tra ve loi 400.<br>- Input dung duoc luu thanh cong vao `metadata`.<br>- Workflow hook khong ghi de hoac lam mat cac truong `metadata` co san truoc do.<br>- Admin Widget tai `customer.details` render dung du lieu va xu ly fallback muot ma khi thieu du lieu. |
| **Cum 2 (Task 5 - 6)** | Custom Module, Link, Saga | - Database table cua Loyalty Module va Link table duoc tao dung schema qua Medusa migration.<br>- Query Graph truy van thanh cong Customer kem LoyaltyAccount.<br>- Database unique constraint tren ledger/claim ngan chan thanh cong retry cap diem 2 lan tu hai execution doc lap truoc khi balance bi thay doi.<br>- Khi inject loi chu dong o Step 4 cua Workflow, Saga Compensation thuc thi thanh cong rollback sach se ca atomic decrement (Step 3) va xoa ledger claim (Step 2) ve trang thai ban dau. |
| **Cum 3 (Task 7 - 8)** | Reconciliation, Order Transfer, Social Auth | - Kiem thu thanh cong ca 4 trang thai tai khoan: Guest-only, Registered-only, ca hai cung ton tai mot email, va nhieu AuthIdentity cung lien ket ve mot Customer.<br>- Luong production chuyen don hang an toan qua `requestOrderTransferWorkflow` -> `acceptOrderTransferWorkflow` co xac minh token ma khong can can thiep trai phep vao `has_account`.<br>- Bao cao ro gioi han va rui ro cua In-place Upgrade so voi public Customer contract trong Research Spike.<br>- Xac thuc OAuth phan nhanh chinh xac vao 3 luong va client nhan JWT hop le chua `actor_id` sau khi goi `POST /auth/token/refresh`. |

---

## 7. Huong dan Thuc hanh Tien do (Interactive Pair-Programming)

De dam bao hieu sau kien truc va tu tay lam chu ma nguon, tien trinh duoc thuc hien theo nguyen tac:
1. **Giai thich Kien truc & Concept:** Trao doi ro co che hoat dong, luong du lieu va cac bien the cua Medusa v2.20.1.
2. **Nguoi hoc Tu tay Viet Code:** Mentor neu ro yeu cau ky thuat va contract; hoc vien truc tiep go code trong editor.
3. **Review & Doi chieu:** Mentor kiem tra file qua cong cu view_file va chi ra cac diem can toi uu (neu co).
4. **Kiem chung Thuc te (Verification Gate):** Chay test hoac gui request API kiem chung truoc khi chuyen sang task tiep theo.
