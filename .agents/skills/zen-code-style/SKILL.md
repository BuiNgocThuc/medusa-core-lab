---
name: zen-code-style
description: >
  Personal Zen Code Style specification for Medusa v2 / TypeScript backend.
  Encodes Visual Rhythm (Block Padding + Statement Spacing), Bilingual Architectural
  Comments, and Zero Logic Drift guarantees. Operates in two profiles:
  lab-personal (medusa-core-lab) and team-production (medusa-learn / shared repos).
  Load this skill whenever formatting, reviewing, or writing TypeScript backend files.
applies_to:
  - "**/*.ts"
  - "!**/*.tsx"
  - "!**/node_modules/**"
profiles:
  lab-personal:
    semicolons: true
    comments: bilingual-vi-en
    indent: 2
  team-production:
    semicolons: false
    comments: english-only
    indent: 2
---

# Skill: @zen-code-style

## 0. Mục Đích (Purpose)

Skill này cung cấp cho AI một bộ quy tắc định dạng mã nguồn TypeScript **có chủ đích và nhất quán**, thoát khỏi sự ép buộc cơ học của các formatter mặc định (Prettier/ESLint). Nó không thay thế ESLint — nó bổ sung **khoảng thở thị giác (Visual Rhythm)** và **chú thích kiến trúc 2 tầng (Bilingual Architectural Comments)** mà ESLint không thể diễn đạt.

---

## 1. Profile Resolver (Phân Tích Tự Động)

Khi áp dụng skill này, AI phải xác định profile theo thứ tự ưu tiên:

1. **Tham số tường minh:** `--profile=lab` hoặc `--profile=prod` → Dùng ngay.
2. **File marker:** Tìm file `.zen-profile` tại root của repo. Nội dung là `lab-personal` hoặc `team-production`.
3. **Đường dẫn workspace (Personal Learning Repos):**
   - Chứa `medusa-core-lab` → **`lab-personal`**
   - Chứa `medusa-learn` → **`lab-personal`** (cũng là personal learning repo)
   - Cả hai repo này đều do 1 developer sở hữu cá nhân, không phải shared team repo.
4. **`team-production` chỉ dùng khi:** Submit PR lên shared team repo thực sự, hoặc được chỉ định tường minh.
5. **Fallback:** Nếu không xác định được → Hỏi người dùng. **Không được im lặng chọn mặc định.**

> **Ghi chú kiến trúc:** Quy định "No semicolons, English-only comments" trong `AGENTS.md` là chuẩn của Medusa framework team dành cho contributors. Trong personal learning repos, developer hoàn toàn có quyền áp dụng phong cách cá nhân (`lab-personal`) để phục vụ mục tiêu học tập sâu.

---

## 2. Execution Block Decision Table (Bảng Phân Loại Bắt Buộc)

Trước khi quyết định có chèn dòng trống hay không, AI phải phân loại khối `{}` theo bảng sau:

| Cú pháp | Phân loại | Zen Block Padding? |
| :--- | :--- | :---: |
| `function foo() { ... }` (nhiều câu lệnh) | Execution Block | **CÓ** |
| `async () => { ... }` (nhiều câu lệnh) | Execution Block | **CÓ** |
| `try { ... }` / `catch { ... }` / `finally { ... }` | Execution Block | **CÓ** |
| `if (...) { ... }` / `else { ... }` | Execution Block | **CÓ** |
| `for/while/do { ... }` | Execution Block | **CÓ** |
| `interface Foo { ... }` | Type Boundary | **KHÔNG** |
| `type X = { ... }` | Type Boundary | **KHÔNG** |
| `import { A, B } from "..."` | Import Boundary | **KHÔNG** |
| `export const config = { ... }` ≤ 2 keys | Config Literal | **KHÔNG** |
| `export const config = { ... }` > 2 keys có nested | Complex Object | **CÓ** |
| `const obj = { a, b }` (destructured assignment) | Destructuring | **KHÔNG** |
| `catch (e) {}` (empty) / `() => null` | Empty Block | **KHÔNG** (giữ 1 dòng) |
| `case "A": { ... }` | Scoped Case | **CÓ** (trong `{}`, nhưng max 1 dòng trống sau `case:`) |
| `enum Foo { A, B, C }` ≤ 3 values | Compact Enum | **KHÔNG** |
| `enum Foo { ... }` > 3 values | Full Enum | **CÓ** |

---

## 3. Quy Tắc Cốt Lõi (Core Formatting Rules)

### Rule 1: Block Padding (Execution Blocks Only)

Mọi Execution Block đều có 1 dòng trống sau `{` mở và 1 dòng trống trước `}` đóng.

```typescript
// BAD
async function handler({ container }: Args) {
  const service = container.resolve(Modules.CUSTOMER)
  return service.list()
}

// GOOD
async function handler({ container }: Args) {

  const service = container.resolve(Modules.CUSTOMER)

  return service.list()

}
```

### Rule 2: Statement Spacing

Các câu lệnh logic độc lập được ngăn cách bởi 1 dòng trống.

```typescript
// BAD
const customerId = data.id
let customer
try {

// GOOD
const customerId = data.id

let customer

try {
```

### Rule 3: Max 1 Empty Line (Collapsing Invariant)

Bất kỳ chuỗi `\n\n\n+` nào (≥ 2 dòng trống liên tiếp) đều bị gộp về **1 dòng trống duy nhất** `\n\n`.

```typescript
// BAD — 2 dòng trống liên tiếp → vi phạm no-multiple-empty-lines


const x = 1

// GOOD — đúng 1 dòng trống

const x = 1
```

### Rule 4: Single-Line Integrity (Anti-Wrap)

Biểu thức ≤ 100 ký tự không được phép bẻ dòng.

```typescript
// BAD
if (
  error?.type === "not_found"
) {

// GOOD (≤ 100 chars → giữ 1 dòng)
if (error?.type === "not_found") {
```

### Rule 5: Condition Boundary (Multi-line Conditions)

Khi điều kiện `if/while/for` phải xuống nhiều dòng, dấu `(` mở và `)` đóng là **Condition Boundary** — **CẤM** chèn dòng trống bên trong.

```typescript
// BAD
if (

  error?.type === "not_found" ||
  error?.message?.includes("was not found")

) {

// GOOD
if (
  error?.type === "not_found" ||
  error?.message?.includes("was not found")
) {
```

### Rule 6: Decorator & IDE Directive — Zero Detachment

JSDoc, Decorators, và comment chỉ dẫn IDE phải nằm **sát ngay trên** khai báo đích. Tuyệt đối không có dòng trống xen vào giữa.

```typescript
// BAD
// noinspection JSUnusedGlobalSymbols

export default async function handler(...) {

// GOOD
// noinspection JSUnusedGlobalSymbols
export default async function handler(...) {
```

### Rule 7: Trailing Comment — Keep Inline

Comment inline cuối dòng (`trailing comment`) giữ nguyên vị trí trên cùng dòng với câu lệnh khi độ dài ≤ 80 ký tự. Chỉ chuyển lên dòng riêng khi comment > 80 ký tự.

```typescript
// BAD — chuyển comment lên dòng riêng
// Truyền idempotency_key để đảm bảo tính duy nhất
idempotency_key: `welcome-customer:${customer.id}:email`,

// GOOD — giữ inline
idempotency_key: `welcome-customer:${customer.id}:email`, // Truyền idempotency_key để đảm bảo tính duy nhất
```

### Rule 8: String & Regex Literals — Forbidden Zone

**CẤM TUYỆT ĐỐI** can thiệp vào bên trong: String Literals, Template Strings, Regular Expressions, Tagged Templates (`sql\`...\``, `html\`...\``).

```typescript
// BAD — chèn dòng trống vào bên trong regex
const pattern = /^[0-9]{

  8,20

}$/

// GOOD — giữ nguyên
const pattern = /^[0-9]{8,20}$/
```

### Rule 9: Method Chaining (100-char Threshold)

- ≤ 100 ký tự: giữ trên 1 dòng.
- > 100 ký tự: bẻ dòng, thụt lề 2 spaces cho từng method con.

### Rule 10: Guard Clause Structure

Guard clause (`if early-return`) không thêm padding thừa:

```typescript
// GOOD: guard clause gọn gàng
if (!customer.email) {

  console.log(`[customer-created] Customer ${customerId} has no email. Skipping...`)
  return

}
```

---

## 4. Bilingual Comment Specification (Profile: lab-personal)

Chú thích trong Zen Code Style giải thích **"Tại sao?" (Architectural Intent)**, không mô tả lại tên biến.

### Cấu trúc chuẩn:

```typescript
// [Số]. [English Title] | [Tiêu đề Tiếng Việt có dấu]
// [Giải thích ngữ cảnh nghiệp vụ — Tiếng Việt]
// [Technical rationale — English]
```

### Ví dụ:

```typescript
// 1. Resolve domain services | Nạp các service nghiệp vụ từ DI container
// Medusa dùng IoC container để inject module service, không import trực tiếp
// Container resolves module services via IoC — avoids tight coupling to implementations
const customerModuleService: ICustomerModuleService = container.resolve(Modules.CUSTOMER);
```

### Profile `team-production`:

Chỉ giữ dòng tiếng Anh. Toàn bộ dòng Tiếng Việt bị loại bỏ khi chuyển sang production profile.

```typescript
// 1. Resolve domain services
// Container resolves module services via IoC — avoids tight coupling to implementations
const customerModuleService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
```

---

## 5. Suppression Comment

Mọi hàm được framework tự động gọi (Subscriber default export, Workflow step) phải có:

```typescript
// noinspection JSUnusedGlobalSymbols
export default async function subscriberHandler(...) {
```

---

## 6. AI Invariant Checklist (Bắt Buộc Trước Khi Xuất Kết Quả)

Trước khi xuất mã nguồn đã format, AI **bắt buộc** tự xác nhận 4 điểm sau. Nếu bất kỳ điểm nào SAI → DỪNG và báo lỗi.

| # | Câu hỏi tự kiểm | Kết quả chấp nhận |
| :-: | :--- | :--- |
| **1** | Tôi có thêm/xóa/thay đổi bất kỳ **identifier, keyword, operator, literal value** nào không? | KHÔNG có thay đổi |
| **2** | Tôi có thay đổi bất kỳ **dấu ngoặc, dấu phẩy, toán tử** nào không? | KHÔNG có thay đổi |
| **3** | **Import statements** có đúng thứ tự và đầy đủ như ban đầu không? | CÓ — không mất import |
| **4** | Có dòng trống nào ≥ 2 liên tiếp tồn tại sau khi format không? | KHÔNG — đã collapse |

---

## 7. 24 Edge Cases Lookup Table

Xem Implementation Plan để tra cứu đầy đủ 24 edge cases. Tóm tắt quick-lookup:

| # | Edge Case | Action |
| :-: | :--- | :--- |
| 1 | String/Regex/Template có `{}` | CẤM can thiệp |
| 2 | Empty block `{}` | Giữ 1 dòng |
| 3 | Guard clause ngắn | Padding nhẹ |
| 4 | Config object ≤ 2 keys | Không padding |
| 5 | `import { ... }` | CẤM padding |
| 6 | JSX/TSX | Không áp dụng |
| 7 | Method chaining | Ngưỡng 100 ký tự |
| 8 | Semicolons | Theo Profile |
| 9 | Từ Việt mới | Sync vietnamese.dic |
| 10 | Switch/Case | 1 dòng trống giữa cases |
| 11 | Nested ternary | Đổi sang if/else |
| 12 | Git Blame Churn | Chỉ file mới/refactor |
| 13 | `interface`/`type` | Compact, không padding |
| 14 | Destructuring params | KHÔNG padding |
| 15 | Arrow fn ≤ 80 chars | Giữ 1 dòng |
| 16 | Decorator/JSDoc | Dính liền, không tách |
| 17 | `case "A": { }` | Max 1 dòng trống sau `case:` |
| 18 | ≥ 2 dòng trống liên tiếp | Collapse → 1 dòng |
| 19 | Inline object trong args | Không padding bên trong |
| 20 | `as any)` casting | Chuẩn hóa khoảng trắng |
| 21 | Workflow step `createStep` | Params gọn, body padding |
| 22 | Enum ≤ 3 values | Compact không padding |
| 23 | Tagged templates `sql\`...\`` | CẤM can thiệp |
| 24 | `"use client"` / Shebang | Giữ dòng 1, 1 dòng trống dưới |
