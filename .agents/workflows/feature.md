---
description: Implement feature mới — plan trước, chờ duyệt, rồi mới code
argument-hint: [mô tả feature]
---

# Feature: $ARGUMENTS

## GIAI ĐOẠN 1 — PLAN (dừng lại chờ duyệt)

Trước khi viết bất kỳ dòng code nào, trình bày:

1. **Context**: module bị ảnh hưởng, các file sẽ đụng tới, pattern hiện có trong codebase mà feature này nên bám theo.
2. **Danh sách file** tạo mới / chỉnh sửa, kèm mục đích từng file, ghi rõ layer (controller / service / repository / client / listener / config / mapper).
3. **Edge case** đã nghĩ tới: idempotency (DB unique + app guard), ranh giới `@Transactional` và ai sở hữu nó, concurrency (atomic SQL/update, không read-modify-write), retry / compensation khi bước sau thất bại, message đã ACK nhưng business op chưa xong.
4. **Câu hỏi** nếu yêu cầu còn mơ hồ — đừng đoán.

**DỪNG tại đây và chờ tôi duyệt.**

## GIAI ĐOẠN 2 — IMPLEMENT (chỉ chạy sau khi tôi duyệt)

### Constraints

- Bám đúng pattern và convention đã có trong codebase — không tự nghĩ ra structure mới.
- Không thêm dependency mới nếu chưa hỏi.
- Không mix DTO giữa các module/service — mỗi service sở hữu DTO của mình.
- Tuân thủ toàn bộ quy tắc trong AGENTS.md.

### Success criteria

- [ ] Happy path chạy đúng
- [ ] Edge case đã nêu ở giai đoạn 1 đều được xử lý
- [ ] Exception type + HTTP status đúng theo `.agents/rules/global-exception-handling-java21-springboot4.md`, không expose stack trace / DB error ra client
- [ ] Có unit test cho logic chính (service layer, JUnit 5 + Mockito + AssertJ)
- [ ] `mvn clean verify -B -DskipTests=false` xanh — SpotBugs + FindSecBugs không Medium/High

think hard
