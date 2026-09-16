---
type: project
created: 2026-07-18
updated: 2026-09-14
---

# Technical Decisions

- Component metadata uses SemVer while the toolkit release keeps CalVer.
- `manifest.json` and `manifest.lock.json` must remain synchronized with component frontmatter.
- Tich hop Plugin `medusa-dev` va MCP server `medusa-docs` de ho tro phat trien theo dung chuan kien truc Medusa v2.
- Bien soan huong dan `notes/ai-tools-guide.md` va lien ket trong `README.md` de chuan hoa workflow AI theo tung Phase hoc tap.
- Chuan hoa tai lieu Customer Module tren Notion thanh 5 Phase doc lap, khai thac truc tiep du lieu tu PostgreSQL (`medusa_db`) va source code `@medusajs/medusa` v2.20.1 (`notes/customer-module-notion-plan.md`).
- Chuan hoa lo trinh 8 Tasks Medusa v2 Customer Module theo public DTO contract cua Medusa 2.20.1 (`has_account` immutability, Admin API validation boundary, safe Saga sequence, persistent DB idempotency, production Order Transfer qua `requestOrderTransferWorkflow` / `acceptOrderTransferWorkflow`).
