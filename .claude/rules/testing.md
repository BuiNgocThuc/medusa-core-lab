---
paths:
  - "**/src/test/**/*.java"
---

# Test — pointer

Nội dung đầy đủ: `@.agents/rules/03-unit-testing-rules.md`

- JUnit 5 + Mockito + AssertJ, layout AAA. Đặt tên test theo **behavior**, không theo implementation.
- Assert dữ liệu trả về / argument đã capture — không assert việc gọi setter.
- Không sửa test cũ cho pass: test đỏ nghĩa là contract đã bị phá.
- Mỗi test kiểm tra đúng một thứ. Không mock thứ không cần mock.
