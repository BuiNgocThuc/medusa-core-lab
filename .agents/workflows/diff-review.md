---
description: Review code, phân loại issue theo mức nghiêm trọng
argument-hint: [file, module, hoặc để trống để review diff chưa commit]
allowed-tools: Read, Grep, Glob, Bash(git diff:*), Bash(git status:*)
---

# Code Review

## Phạm vi

$ARGUMENTS

Nếu phần trên để trống, review toàn bộ diff chưa commit. Diff có thể đã được nhúng sẵn bên dưới; nếu chưa có, tự chạy `git diff HEAD` để lấy.

## Cách review

Chỉ nêu vấn đề thật. Bỏ qua mọi thứ formatter đã lo, và bỏ qua thứ SpotBugs / FindSecBugs đã bắt được ở CI gate.
Không bới lông tìm vết về style.

Phân loại từng issue:

- 🔴 **Blocker** — bug, lỗ hổng bảo mật, nguy cơ mất dữ liệu, race condition, `@Transactional` sai ranh giới, ACK message trước khi business op xong, dùng `float`/`double` cho tiền, log PII
- 🟡 **Should fix** — performance, edge case chưa xử lý, error handling thiếu, thiếu idempotency, exception bị nuốt không log
- 🔵 **Nit** — có thì tốt, không có cũng không sao

## Format mỗi issue

`order-service/src/main/java/vn/conghung/service/OrderService.java:42` → vấn đề là gì → cách sửa đề xuất

Nếu code ổn, nói thẳng là ổn. Đừng bịa ra issue cho có.

think hard
