---
description: Fix bug theo quy trình CONTEXT / ROOT CAUSE / CONSTRAINTS / SUCCESS
argument-hint: [mô tả bug hoặc đường dẫn file]
---

# Bug Fix: $ARGUMENTS

Làm theo đúng quy trình dưới đây.

## 1. CONTEXT

Xác định chính xác module, class và method liên quan tới: $ARGUMENTS
Đọc code trước khi kết luận. Nếu tôi chưa cung cấp repro steps hoặc log/stack trace, hỏi tôi.

## 2. ROOT CAUSE

Giải thích nguyên nhân gốc bằng 2-3 câu TRƯỚC khi sửa bất cứ dòng nào.
Nếu chưa chắc chắn, nói rõ là chưa chắc và đề xuất cách kiểm chứng.

## 3. CONSTRAINTS

- Chỉ sửa trong phạm vi method/class gây lỗi. KHÔNG refactor rộng.
- Không đổi public API, method signature, hay DTO contract giữa các service.
- Không thêm dependency mới.
- Diff tối thiểu.

## 4. SUCCESS CRITERIA

- [ ] Bug không còn tái hiện theo repro steps
- [ ] `mvn test -pl <module> -am` xanh — toàn bộ test hiện có vẫn pass
- [ ] Thêm 1 regression test cho đúng case này: đặt tại `<module>/src/test/java/...`, naming `*Test.java`, JUnit 5 + Mockito + AssertJ, layout AAA
- [ ] `mvn -q clean verify -B -DskipTests=false -pl <module> -am` xanh (SpotBugs + FindSecBugs không Medium/High)
- [ ] Không sửa test cho pass — sửa code cho đúng

## 5. BÁO CÁO

Liệt kê file đã sửa (full path) và lý do từng thay đổi.

think hard
