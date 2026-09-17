# Tech Context

## Technologies
- **Core Framework:** Medusa v2 (@medusajs/medusa v2.20.1)
- **Runtime:** Node.js (v24.18.0 via NVM), TypeScript (v5.6)
- **Database:** PostgreSQL (v15+) tren cong 5434 (`medusa_core_lab_db` trong container `medusa_core_lab_postgres`, role `agents` password `root123`)
- **Cache / PubSub:** Redis (v7+) tren cong 6381 (`medusa_core_lab_redis`)
- **Backend Port:** Port 9000 (tranh xung dot voi Portainer tren port 9001)
- **Storefront Port:** Next.js tren port 8000
- **Package Manager:** pnpm (v10.11.1 / v11)
- **Code Quality & Linter:** ESLint voi `@medusajs/eslint-plugin` (tuan thu convention 2 spaces, double quotes, no semicolons qua `medusa lint`)
- **AI Tooling & Skills:** 
  - Medusa MCP Server (`https://docs.medusajs.com/mcp`)
  - Database MCP Server: `medusa_core_lab_db` (PostgreSQL port 5434 qua `@modelcontextprotocol/server-postgres`) va `medusa_db` (port 5433)
  - Notion MCP (`@notionhq/notion-mcp-server`)
  - LarkSuite MCP (`larksuite` cho bao cao hang ngay `/daily-report` Base)
  - Plugin `medusa-dev` (7 Medusa agentic skills)
  - Bruno API Client (`bruno/` directory tai root): Bo suu tap kiem thu Black-box dat 10/10 requests PASS (27/27 assertions PASS), token Bearer tu dong qua dual-scope storage (`token`), va runner guard `req.getExecutionMode() === "runner"`.

## Development Setup
- Moi truong: Linux/WSL (Ubuntu).
- Lenh Docker: `docker compose up -d` (PostgreSQL port 5434, Redis port 6381).
- Lenh chay Backend: `cd my-medusa-store/apps/backend && pnpm dev` (lang nghe tai port 9000, Admin UI tai `http://localhost:9000/app`).
- Lenh chay Storefront: `cd my-medusa-store/apps/storefront && pnpm dev` (lang nghe tai port 8000).
- Lenh DB: `cd my-medusa-store/apps/backend && pnpm seed` (hoac `pnpm exec medusa db:migrate`).
- Tai lieu hoc tap: `LEARNING_PLAN.md`, `notes/ai-tools-guide.md`, `notes/question.md`, va `notes/customer-module-extension-plan.md`.

## Constraints & Gotchas
- **pnpm v9 strictness:** Loi `[ERR_PNPM_IGNORED_BUILDS]` trong Medusa v2 can duoc giai quyet bang `pnpm approve-builds` truoc khi install.
- **Publishable Key:** Storefront va cac endpoint duoi `/store/*` bat buoc phai co `x-publishable-api-key` header (hoac `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`) hop le, neu khong se nhan loi `400 / 401 not_allowed`. Cac custom root endpoint (nhu `/hello-world`) khong nam duoi `/store/*` se khong bi chan boi middleware nay.
- **Guard System:** Moi tac vu AI thay doi file he thong phai tuan thu luat cam ghi tai `.agents/protected-paths.txt`.
- **Partial Unique Index Gotcha:** Index tren `customer_address` (`IDX_customer_address_unique_customer_shipping`) KHONG co dieu kien `deleted_at IS NULL`. Do do khi soft-delete dia chi mac dinh, bat buoc phai go co `is_default_shipping = false` truoc, neu khong khach hang se bi chan vinh vien khong the them dia chi mac dinh moi.
- **Saga Compensation vs Irreversible Actions:** Tuyet doi khong dat cac hanh dong vien thong ngoai he thong (gui Email, Zalo ZNS, SMS) vao Workflow Hooks vi Compensation Step khong the thu hoi tin nhan da gui. Cac hanh dong nay bat buoc phai giao cho Event Subscriber (`customer.created`).
- **Admin vs Store API Validation Boundary:** `POST /admin/customers` ho tro `WithAdditionalData` va `additionalDataValidator`, trong khi `POST /store/customers` su dung `StoreCreateCustomer` khong ho tro `additional_data`. Storefront truyen custom data qua truong `metadata` hoac qua custom Store route + workflow.
- **DTO Immutability Gotcha:** `has_account` chi co trong `CreateCustomerDTO`. `UpdateCustomerDTO` va `CustomerUpdatableFields` khong cho phep cap nhat truong nay.
- **JWT Refresh Gotcha:** Sau khi thuc hien mapping Customer vao `AuthIdentity`, client phai goi endpoint `POST /auth/token/refresh` de nhan token JWT moi chua `actor_id` (`customer_id`).
- **Persistent Idempotency Gotcha:** Step idempotency hoac transaction ID trong Workflow Engine chi co hieu luc trong mot workflow execution. De ngan chan cap phat trung lap tu cac request doc lap, bat buoc phai thiet lap DB unique constraint (vi du `UNIQUE(customer_id, reward_type, source_id)`).
- **LarkSuite Bitable Payload Gotcha:** Field `Description` tren Bitable API nhan plain-text string (co chua `\n`), neu gui duoi dang mang object `[{ type: "text", text: ... }]` se bi tu choi voi ma loi `1254060 TextFieldConvFail`. Dong thoi field `Assignee` la User Object, query filter truc tiep bang ten string se gap loi `1254018 InvalidFilter`.
- **Medusa Duplicate Error HTTP Status:** Trong Medusa v2 `createCustomersStep`, khi duplicate email tren cung mot gia tri `has_account` bi phat hien, he thong nem `MedusaError.Types.INVALID_DATA` ("Customer with email: ... already exists") map ve ma HTTP `400` (Bad Request). Trong khi do o cac luong auth/profile khac `DUPLICATE_ERROR` co the map ve `422`. Bo test Bruno duoc thiet ke chap nhan `[400, 409, 422]` de bao dam tinh bao quat.
- **Bruno In-Memory Session Gotcha:** Cac bien set bang `bru.setEnvVar()` / `bru.setVar()` chi luu trong RAM cua phien chay Bruno hien tai. Khi restart Bruno app, bien bi xoa; de cleanup can query ID tu DB/Admin UI.
- **Secret Isolation in Git:** File `.agents/mcp_config.json`, `.vscode/`, va `.antigravitycli/` chua token nhay cam cua Notion, Lark, hoac local execution logs bat buoc phai dat trong `.gitignore`. Da ap dung GitHub Push Protection mitigation thanh cong.
