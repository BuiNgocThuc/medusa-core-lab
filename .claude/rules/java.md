---
paths:
  - "**/*.java"
---

# Java / Spring — pointer

Nội dung đầy đủ: `@.agents/rules/01-backend-java-spring-rules.md` · `@.agents/rules/05-java-code-formatting-rules.md` · exception: `@.agents/rules/global-exception-handling-java21-springboot4.md` · MapStruct/Outbox: `@.agents/rules/06-mapstruct-outbox-rules.md`

Non-negotiable:
- Tiền dùng `BigDecimal`, không `float`/`double`.
- Không nuốt exception — log có ngữ cảnh hoặc rethrow.
- Không log PII / số tài khoản / số dư.
- Controller là glue: deserialize → gọi service → serialize.
- `@Transactional` phải rõ owner + ranh giới; không gọi I/O ngoài trong transaction.
