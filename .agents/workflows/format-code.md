# Workflow: /format-code

## Mô Tả

Apply Zen Code Style formatting to a TypeScript backend file.

**Cú pháp:**
```
/format-code [file-path] [--profile=lab|prod] [--dry-run]
```

**Ví dụ:**
```
/format-code src/subscribers/customer-created.ts
/format-code src/api/middlewares.ts --profile=prod
/format-code src/modules/loyalty/service.ts --dry-run
```

---

## Quy Trình Thực Thi (6 Steps)

### Step 0: Load Skill

```
📚 Using skill: @zen-code-style
```

Đọc `@[.agents/skills/zen-code-style/SKILL.md]` trước khi làm bất cứ điều gì.

---

### Step 1: Resolve Profile

Xác định profile theo thứ tự ưu tiên:

1. Tham số `--profile=lab` hoặc `--profile=prod` → Dùng ngay.
2. File `.zen-profile` tại root repo → Đọc nội dung.
3. Đường dẫn workspace chứa `medusa-core-lab` → `lab-personal`.
4. Đường dẫn workspace chứa `medusa-learn` → `team-production`.
5. Không xác định được → **Hỏi người dùng**, không chọn mặc định.

In ra:
```
Profile resolved: lab-personal
Reason: workspace path contains 'medusa-core-lab'
```

---

### Step 2: Pre-flight Snapshot

Trước khi thay đổi bất cứ thứ gì, lưu nội dung file gốc vào bộ nhớ tạm để rollback nếu cần.

```
Snapshot saved: src/subscribers/customer-created.ts @ 2026-09-15T10:55:00
```

> **Quan trọng:** Không ghi bất kỳ file nào trong bước này.

---

### Step 3: Apply Zen Formatting

Đọc file và áp dụng các quy tắc theo thứ tự:

1. **Execution Block Decision:** Phân loại từng `{}` theo Bảng 2 trong SKILL.md.
2. **Block Padding:** Chèn 1 dòng trống sau `{` và trước `}` cho Execution Blocks.
3. **Statement Spacing:** Chèn 1 dòng trống giữa các câu lệnh độc lập.
4. **Collapsing Invariant:** Gộp mọi chuỗi ≥ 2 dòng trống về 1 dòng.
5. **Profile Filter:**
   - `lab-personal`: Giữ/bổ sung chú thích song ngữ, giữ `;`.
   - `team-production`: Loại bỏ dòng comment Tiếng Việt, xóa `;`.
6. **Decorator/JSDoc Detachment Check:** Đảm bảo không có dòng trống giữa directive và khai báo.
7. **Trailing Comment:** Giữ comment inline ≤ 80 ký tự trên cùng dòng.

---

### Step 4: AI Invariant Checklist

**BẮT BUỘC** trước khi xuất kết quả. Trả lời 4 câu hỏi:

| # | Kiểm tra | Kết quả |
| :-: | :--- | :--- |
| 1 | Identifier / keyword / operator / literal value có thay đổi không? | KHÔNG |
| 2 | Dấu ngoặc / dấu phẩy / toán tử có thay đổi không? | KHÔNG |
| 3 | Import statements đầy đủ và đúng thứ tự? | CÓ |
| 4 | Còn dòng trống ≥ 2 liên tiếp nào không? | KHÔNG |

Nếu bất kỳ câu nào sai → **DỪNG**, in lỗi, rollback về Snapshot, báo cáo vị trí lỗi.

---

### Step 5: Output Diff Preview

In ra Unified Diff style để người dùng kiểm tra trước khi ghi đè:

```diff
--- src/subscribers/customer-created.ts (original)
+++ src/subscribers/customer-created.ts (zen-formatted)
@@ -5,8 +5,12 @@
 export default async function customerCreatedHandler ({
     event: { data },
     container,} : SubscriberArgs<{ id: string}>) {
+
     const customerModuleService : ICustomerModuleService = container.resolve(Modules.CUSTOMER);
+
     const notificationModuleService : INotificationModuleService = container.resolve(Modules.NOTIFICATION);
```

Kết thúc bằng:
```
Lines changed: +12 / -0 (whitespace and comments only)
Logic tokens: UNCHANGED ✓
Profile: lab-personal

Apply changes? (yes/no)
```

---

### Step 6: Write File (On User Approval)

- Nếu người dùng xác nhận `yes` → Ghi đè file với nội dung đã format.
- Nếu `no` hoặc `--dry-run` → Không ghi, hiển thị kết quả để tham khảo.
- Sau khi ghi → Xóa snapshot tạm.

---

## Khi Nào Nên Dùng `/format-code`

| Tình huống | Dùng? |
| :--- | :---: |
| File mới vừa tạo | **Có** |
| File đang trong task refactor | **Có** |
| File production ổn định, không trong scope refactor | **Không** (Git Blame Churn) |
| File `.tsx` / Admin UI | **Không** (JSX boundary) |
| Toàn bộ codebase 1 lúc | **Không** (quá rủi ro với blame churn) |

---

## CLI Verification Gate (Sau Khi Áp Dụng)

Sau khi format và ghi file, cung cấp CLI task block để người dùng xác nhận:

```bash
mkdir -p .antigravitycli/logs

# Gate 1: Unit tests (không được break)
cd my-medusa-store/apps/backend && \
  pnpm run test:unit 2>&1 | tee .antigravitycli/logs/zen-format-test.log

# Gate 2: Lint (profile team-production phải đạt 0 errors)
cd my-medusa-store/apps/backend && \
  pnpm run lint 2>&1 | tee .antigravitycli/logs/zen-format-lint.log
```

Paste kết quả để AI xác nhận PASS/FAIL.
