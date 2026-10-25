# Prompt: Audit Bank Transfer & Thiết kế MoMo Payment cho MedusaJS

Bạn đang đóng vai trò **Senior Backend Engineer / Payment Integration Engineer**, có kinh nghiệm với:

- MedusaJS v2
- Payment Module / Payment Provider
- TypeScript / Node.js
- Webhook
- Payment gateway
- MoMo Payment
- Banking / QR payment
- Idempotency
- Payment reconciliation
- Distributed systems
- Production deployment và security

Tôi đang phát triển một hệ thống ecommerce sử dụng **MedusaJS v2**.

Trong project hiện tại đã có một custom **Bank Transfer Payment Provider**.

Tài liệu mô tả implementation hiện tại:

`BANK_TRANSFER_IMPLEMENTATION_GUIDE.md`

## Mục tiêu

Hãy **đọc source code thực tế của project trước**, sau đó đối chiếu với tài liệu trên và tài liệu chính thức của Medusa/MoMo.

Không được chỉ dựa vào `BANK_TRANSFER_IMPLEMENTATION_GUIDE.md`.

Tôi muốn bạn thực hiện 4 nhiệm vụ lớn:

1. Audit và giải thích toàn bộ Bank Transfer payment flow hiện tại.
2. Đánh giá những phần nào có thể tái sử dụng cho MoMo.
3. Thiết kế kiến trúc và implementation plan chi tiết cho **MoMo Payment / MoMo Banking**.
4. Viết tài liệu hoàn chỉnh hướng dẫn từ development → testing → sandbox → staging → production deployment.

---

# PHASE 1 — DISCOVER PROJECT

Trước khi đề xuất code mới, hãy đọc cấu trúc project.

Bắt đầu từ:

`BANK_TRANSFER_IMPLEMENTATION_GUIDE.md`

Sau đó tìm và đọc toàn bộ source code liên quan tới payment.

Đặc biệt kiểm tra:

## Backend config

- `medusa-config.ts`
- `.env.template`
- package dependencies
- payment provider registration
- region/provider configuration

## Bank Transfer Provider

Tìm và đọc:

- `src/modules/bank-transfer/**`
- `index.ts`
- `service.ts`
- `types.ts`

Phân tích các method Medusa Payment Provider như:

- `initiatePayment`
- `updatePayment`
- `authorizePayment`
- `capturePayment`
- `cancelPayment`
- `refundPayment`
- `retrievePayment`
- `deletePayment`
- `getPaymentStatus`
- `getWebhookActionAndData`

Không giả định method tồn tại. Hãy kiểm tra source code thực tế.

## Bank Transfer Ledger

Đọc:

`src/modules/bank-transfer-payment/**`

Bao gồm:

- service
- models
- migrations
- types

Đặc biệt phân tích:

- `bank_payment_reference`
- `bank_transaction`
- `bank_webhook_event`

## Webhook

Đọc:

`src/api/webhooks/payments/bank/**`

và kiểm tra route chuẩn:

`/hooks/payment/bank-transfer_default`

Phân tích sự khác biệt giữa:

1. Medusa standard webhook flow.
2. Custom/lab webhook flow.

## Storefront

Tìm toàn bộ code liên quan:

- payment provider selection
- payment session
- payment UI
- payment button
- `placeOrder`
- payment result

## Background jobs

Kiểm tra:

- payment expiration
- reconciliation
- retry
- cleanup jobs

---

# PHASE 2 — RECONSTRUCT CURRENT PAYMENT FLOW

Sau khi đọc source code, hãy reconstruct chính xác Bank Transfer flow.

Mô tả theo sequence:

```text
Customer
→ Storefront
→ Medusa Store API
→ Payment Collection
→ Payment Session
→ Bank Transfer Provider
→ Ledger
→ Complete Cart
→ Order
→ Bank Webhook
→ Reconciliation
→ Medusa Payment Module
→ Authorized
→ Captured
```

Với mỗi bước hãy ghi:

- API endpoint
- file xử lý
- function/method
- input
- output
- database thay đổi
- payment status trước
- payment status sau
- failure cases

Tạo thêm **Mermaid sequence diagram**.

---

# PHASE 3 — AUDIT CURRENT IMPLEMENTATION

Đánh giá implementation hiện tại theo các nhóm.

## Architecture

- separation of concerns
- Provider vs Ledger
- coupling
- maintainability
- extensibility

## Payment correctness

Kiểm tra lifecycle:

```text
pending → pending_authorization → authorized → captured
```

Xác định lifecycle thực tế từ code, không chỉ từ guide.

## Idempotency

Kiểm tra:

- duplicate webhook
- duplicate transaction
- duplicate capture
- webhook retry
- race condition

## Reconciliation

Kiểm tra:

- exact payment
- underpaid
- overpaid
- unknown reference
- wrong currency
- expired payment
- transaction đến sau khi payment đã matched
- transaction đến trước/sau order creation

## Security

Kiểm tra:

- webhook authentication
- secret management
- raw payload
- signature verification
- replay attack
- timing-safe comparison
- logging sensitive information
- rate limiting

## Database

Kiểm tra:

- unique constraints
- indexes
- transaction boundaries
- race conditions
- concurrency
- auditability

Mỗi vấn đề tìm được hãy phân loại:

- `BLOCKER`
- `HIGH`
- `MEDIUM`
- `LOW`
- `GOOD`

Và trình bày theo format:

```text
Problem
→ Why it matters
→ Current code
→ Recommended fix
```

**Không sửa code ngay trong phase này.**

---

# PHASE 4 — RESEARCH MOMO

Tiếp theo hãy nghiên cứu **tài liệu chính thức mới nhất của MoMo dành cho merchant/developer**.

Ưu tiên official documentation.

Xác định chính xác các phương thức phù hợp với hệ thống ecommerce này, ví dụ nếu được MoMo hỗ trợ:

- MoMo Wallet
- QR payment
- Banking / bank-linked payment
- payment link
- redirect/deeplink
- IPN/webhook
- query transaction
- refund

Không được tự giả định API.

Nếu thuật ngữ **"MoMo Banking"** không phải tên chính thức của sản phẩm/API MoMo, hãy chỉ rõ terminology chính xác trước khi thiết kế.

Xác định các field/khái niệm theo đúng API/version được chọn, ví dụ:

- `partnerCode`
- `accessKey`
- `secretKey`
- `requestId`
- `orderId`
- `amount`
- `orderInfo`
- `redirectUrl`
- `ipnUrl`
- `requestType`
- `signature`
- `resultCode`
- `transId`

Chỉ sử dụng field thực sự tồn tại trong API/version được chọn.

Xác định rõ:

- Sandbox endpoints
- Production endpoints
- Authentication/signature mechanism
- Request signature construction
- Response signature verification nếu có
- IPN signature verification
- Transaction query API
- Refund API

---

# PHASE 5 — DESIGN MOMO PAYMENT ARCHITECTURE

Thiết kế MoMo theo kiến trúc phù hợp với project hiện tại.

Không copy Bank Transfer provider một cách máy móc.

Trước tiên phân tích:

**Bank Transfer là asynchronous offline transfer.**

Trong khi MoMo là **payment gateway integration**.

Giải thích những khác biệt về:

- payment initiation
- user redirect / QR
- payment confirmation
- IPN
- authorization
- capture
- refund
- expiration
- transaction query

Sau đó quyết định kiến trúc.

Ví dụ cần cân nhắc:

```text
momo-payment provider
```

và nếu cần:

```text
momo-payment ledger/module
```

Hãy quyết định rõ:

- Có reuse `bank-transfer-payment` ledger không?
- Generalize thành `payment-ledger`?
- Hay tạo `momo-payment` module riêng?

Ưu tiên thiết kế maintainable cho tương lai nếu sau này hệ thống thêm:

- VNPay
- ZaloPay
- Stripe
- COD

Nhưng tránh over-engineering.

---

# PHASE 6 — MOMO PAYMENT FLOW

Thiết kế full flow:

```text
Customer
→ Checkout
→ Select MoMo
→ Medusa Payment Session
→ MoMo Provider
→ MoMo Create Payment API
→ payUrl / deeplink / QR
→ Customer pays
→ MoMo
→ IPN
→ Backend
→ verify signature
→ verify amount/order/payment session
→ idempotency
→ update ledger
→ Medusa Payment Module
→ Order/payment update
```

Phải giải thích rõ:

> **Redirect URL KHÔNG được xem là source of truth của payment.**

Payment confirmation phải dựa trên server-side verification/IPN phù hợp với API MoMo.

Tạo Mermaid sequence diagram cho:

1. Successful payment
2. Failed/cancelled payment
3. Duplicate IPN
4. IPN delayed/missing
5. Refund

---

# PHASE 7 — DATA MODEL

Đề xuất database schema.

Ví dụ cân nhắc:

## momo_payment

- id
- payment_session_id
- order_id
- momo_order_id
- request_id
- trans_id
- amount
- currency
- status
- result_code
- pay_url
- deeplink
- qr_code_url
- created_at
- paid_at
- expires_at

## momo_webhook_event

- event identifier
- orderId
- requestId
- transId
- resultCode
- signature verification result
- raw payload
- processing status
- received_at
- processed_at
- error

Không copy schema trên nếu MoMo API thực tế cần cấu trúc khác.

Đề xuất:

- PK
- unique constraints
- indexes
- foreign/reference identifiers
- status enum
- audit fields

Đặc biệt giải quyết race condition bằng **DB constraints/transactions**, không chỉ bằng check trong application memory.

---

# PHASE 8 — MEDUSA PROVIDER DESIGN

Thiết kế:

`MomoPaymentProviderService`

theo chuẩn Medusa v2.

Giải thích trách nhiệm của từng method:

- `initiatePayment`
- `updatePayment`
- `authorizePayment`
- `capturePayment`
- `cancelPayment`
- `refundPayment`
- `retrievePayment`
- `deletePayment`
- `getPaymentStatus`
- `getWebhookActionAndData`

Với mỗi method ghi:

- Purpose
- Input
- MoMo API call nếu có
- DB operation
- Return value cho Medusa
- Error handling
- Idempotency requirement

Không implement method chỉ để "cho đủ interface"; nếu method có semantic đặc biệt thì phải giải thích.

---

# PHASE 9 — IPN / WEBHOOK DESIGN

Đây là phần **critical**.

Thiết kế:

```text
MoMo
→ POST <IPN endpoint>
→ Receive raw request
→ validate required fields
→ verify signature
→ normalize payload
→ identify payment
→ verify orderId
→ verify requestId
→ verify amount
→ check transaction identity
→ idempotency check
→ update ledger
→ trigger Medusa payment workflow
→ return correct acknowledgement
```

Phân tích:

- duplicate IPN
- same `transId` twice
- same `orderId` different `transId`
- invalid signature
- invalid amount
- unknown order
- payment already completed
- expired payment
- late webhook
- out-of-order webhook
- backend crash giữa DB update và Medusa workflow
- MoMo retry

Không được dùng **in-memory Map** cho idempotency.

---

# PHASE 10 — RECONCILIATION

Thiết kế fallback khi IPN không tới.

Ví dụ:

```text
pending payment
→ timeout
→ query MoMo transaction-status API
→ verify result
→ reconcile Medusa payment
```

Đề xuất job:

`reconcile-momo-payments`

Nhưng phải xác định:

- chạy bao lâu một lần
- query payment nào
- retry policy
- exponential backoff nếu cần
- max retry
- dead-letter/manual review
- logging
- metrics

Không spam MoMo API.

---

# PHASE 11 — REFUND

Thiết kế refund flow:

```text
Admin / Medusa
→ refundPayment()
→ MoMo refund API
→ verify response
→ store refund transaction
→ update Medusa
→ reconciliation
```

Phân tích:

- full refund
- partial refund nếu API hỗ trợ
- duplicate refund request
- refund timeout
- refund pending
- refund failed

---

# PHASE 12 — DEVELOPMENT ENVIRONMENT

Viết hướng dẫn từ zero.

## Environment variables

Tách rõ:

- Development/Sandbox
- Staging
- Production

Không hard-code secrets.

Tạo `.env.template` example nhưng dùng placeholder.

## Local development

Hướng dẫn:

```text
install
→ migration
→ provider registration
→ enable provider for region
→ start backend
→ start storefront
→ configure public callback/IPN URL
→ sandbox credentials
→ test checkout
```

Nếu MoMo cần public HTTPS IPN URL, hướng dẫn cách expose localhost an toàn bằng tunnel phù hợp cho development.

Không đưa secret vào URL.

---

# PHASE 13 — SANDBOX TESTING

Tạo test matrix đầy đủ.

Ít nhất gồm:

- successful payment
- user cancel
- failed payment
- invalid signature
- wrong amount
- duplicate webhook
- webhook retry
- delayed webhook
- missing webhook
- transaction query reconciliation
- expired session
- same order paid twice
- backend restart during webhook
- database failure
- MoMo timeout
- refund success
- refund failure

Mỗi testcase ghi:

| Field | Description |
|---|---|
| ID | Test case ID |
| Scenario | Scenario being tested |
| Setup | Required setup |
| Steps | Exact execution steps |
| Expected HTTP result | Expected API result |
| Expected Medusa state | Expected Medusa payment/order state |
| Expected DB state | Expected ledger/database state |
| Expected MoMo state | Expected gateway state |
| Logs | Logs/metrics cần kiểm tra |

---

# PHASE 14 — OBSERVABILITY

Đề xuất structured logs.

Không log:

- `secretKey`
- credentials
- raw sensitive customer data
- authentication secrets

Nên log correlation identifiers như:

- `payment_session_id`
- `order_id`
- `momo_order_id`
- `request_id`
- `trans_id`
- `webhook_event_id`

Đề xuất metrics:

- `momo_payment_created_total`
- `momo_payment_success_total`
- `momo_payment_failed_total`
- `momo_ipn_received_total`
- `momo_ipn_invalid_signature_total`
- `momo_ipn_duplicate_total`
- `momo_reconciliation_total`
- `momo_refund_total`

Đề xuất alert cho các trường hợp:

- invalid signature tăng đột biến
- IPN processing failure
- reconciliation backlog
- refund failures
- MoMo API error rate cao
- pending payment tồn tại quá lâu

---

# PHASE 15 — PRODUCTION SECURITY

Tạo production security checklist.

Bao gồm:

- HTTPS
- secret management
- MoMo credential separation
- sandbox/prod separation
- signature verification
- timing-safe comparison nếu phù hợp
- IPN authentication
- replay protection
- idempotency
- rate limiting
- DB unique constraints
- audit logs
- PII masking
- error sanitization
- credential rotation
- backup
- alerting

Phân biệt rõ:

- `DEV ONLY`
- `PRODUCTION REQUIRED`

---

# PHASE 16 — DEPLOYMENT

Viết hướng dẫn deploy production.

Bao gồm:

1. Production credentials
2. Environment variables
3. Database migration
4. Backend deployment
5. Public HTTPS IPN endpoint
6. Redirect URL
7. Provider enablement
8. Storefront configuration
9. Health check
10. Smoke test
11. Payment test
12. Monitoring
13. Rollback strategy

Đặc biệt phân tích deployment order để tránh:

- code mới chạy trước migration
- provider enable nhưng callback chưa hoạt động
- production dùng nhầm sandbox credential
- webhook tới version backend cũ

Đề xuất pre-deployment checklist và post-deployment checklist.

---

# PHASE 17 — IMPLEMENTATION PLAN

Sau khi hoàn tất analysis, tạo implementation plan chia thành task nhỏ.

Format:

| ID | Task | Files | Description | Dependency | Estimate | Test |
|---|---|---|---|---|---|---|

Estimate theo **giờ engineering thực tế**, bao gồm:

- coding
- unit test
- integration test
- sandbox test
- debugging
- documentation
- review/fix

Không estimate chỉ thời gian viết code.

Chia ít nhất:

- `MOMO-01` Research/API contract
- `MOMO-02` Architecture
- `MOMO-03` Config
- `MOMO-04` Data model
- `MOMO-05` Migration
- `MOMO-06` MoMo API client
- `MOMO-07` Provider
- `MOMO-08` Create payment
- `MOMO-09` IPN
- `MOMO-10` Signature verification
- `MOMO-11` Idempotency
- `MOMO-12` Medusa payment processing
- `MOMO-13` Transaction query
- `MOMO-14` Reconciliation job
- `MOMO-15` Refund
- `MOMO-16` Storefront
- `MOMO-17` Error UX
- `MOMO-18` Unit tests
- `MOMO-19` Integration tests
- `MOMO-20` Sandbox E2E
- `MOMO-21` Security hardening
- `MOMO-22` Observability
- `MOMO-23` Production config
- `MOMO-24` Deployment
- `MOMO-25` Documentation

Có thể thay đổi task nếu sau khi đọc repo thấy cấu trúc khác hợp lý hơn.

---

# PHASE 18 — FILE-BY-FILE CHANGE PLAN

Trước khi code, liệt kê chính xác:

## Files tạo mới

Ví dụ:

`src/modules/momo/...`

## Files sửa

Ví dụ:

- `medusa-config.ts`
- `.env.template`
- storefront payment components

## Files reuse

## Files không nên sửa

Mỗi file ghi rõ lý do.

---

# PHASE 19 — DOCUMENTATION

Sau khi implementation hoàn tất, tạo:

`MOMO_PAYMENT_IMPLEMENTATION_GUIDE.md`

Tài liệu phải đủ để một developer khác clone repo và hiểu được integration.

Structure:

1. Overview
2. Architecture
3. Why MoMo flow differs from Bank Transfer
4. Project files
5. Environment variables
6. Provider registration
7. Database schema
8. Checkout flow
9. Create-payment flow
10. Redirect flow
11. IPN flow
12. Signature verification
13. Idempotency
14. Medusa payment lifecycle
15. Reconciliation
16. Refund
17. Error handling
18. Local development
19. Sandbox setup
20. Manual API testing
21. Automated testing
22. Database verification
23. Security
24. Observability
25. Production deployment
26. Rollback
27. Troubleshooting
28. Production checklist

Thêm Mermaid diagrams và example payload nhưng phải mask credentials.

---

# PHASE 20 — FINAL DELIVERABLES

Cuối cùng trả về:

## A. Current Bank Transfer Audit

Luồng hiện tại và vấn đề phát hiện được.

## B. Bank Transfer vs MoMo

Bảng so sánh:

| Concern | Bank Transfer | MoMo | Reuse? |
|---|---|---|---|

## C. Proposed MoMo Architecture

Architecture + reasoning.

## D. Payment State Machine

Ví dụ:

```text
created
→ pending
→ authorized/paid
→ captured
```

và các nhánh:

```text
failed
cancelled
expired
refunded
manual_review
```

Nhưng state cuối phải dựa trên semantics thực tế của Medusa + MoMo.

## E. Implementation Plan

Tasks + dependency + estimate.

## F. File Change Plan

Create / Modify / Reuse.

## G. Testing Plan

Unit + integration + sandbox + E2E + failure testing.

## H. Dev → Production Guide

Toàn bộ quy trình.

## I. `MOMO_PAYMENT_IMPLEMENTATION_GUIDE.md`

Tài liệu cuối cùng.

---

# IMPORTANT RULES

1. **Read code before proposing implementation.**
2. Không coi `BANK_TRANSFER_IMPLEMENTATION_GUIDE.md` là source of truth duy nhất; đối chiếu code thực tế.
3. Không tự bịa MoMo API, endpoint, field hoặc signature algorithm.
4. Với MoMo, ưu tiên official documentation.
5. Nếu docs và code khác nhau, ghi rõ discrepancy.
6. Không hard-code credentials.
7. Không dùng in-memory state cho payment/idempotency.
8. Redirect từ browser không phải payment source of truth.
9. Webhook/IPN phải idempotent.
10. Payment state phải có DB/audit trail.
11. Không auto-capture nếu amount/order/signature không hợp lệ.
12. Mọi external API call cần timeout và error handling.
13. Thiết kế phải chịu được webhook retry.
14. Thiết kế phải chịu được backend restart.
15. Thiết kế phải xem xét concurrency/race condition.
16. Không sửa code trước khi hoàn thành audit + architecture + implementation plan.
17. Khi bắt đầu coding, implement từng phase nhỏ và test phase đó trước khi sang phase tiếp theo.
18. Không refactor những phần không liên quan nếu không thật sự cần.
19. Giữ Bank Transfer hiện tại hoạt động trong khi thêm MoMo.
20. Mọi quyết định quan trọng phải giải thích **WHY**, không chỉ nói **WHAT**.
21. Với các kết luận về Medusa hoặc MoMo API, dẫn link/tài liệu official tương ứng.
22. Nếu một behavior chưa xác minh được từ code hoặc official docs, đánh dấu rõ **UNVERIFIED**, không suy đoán thành fact.
23. Trước khi production deployment, phải có sandbox E2E test thành công.
24. Mọi webhook handler phải an toàn khi cùng event được gửi nhiều lần.
25. Implementation phải có đường reconciliation khi IPN bị mất hoặc xử lý thất bại.

---

# DEFINITION OF DONE

Integration chỉ được xem là hoàn thành khi:

- Bank Transfer hiện tại vẫn hoạt động.
- MoMo provider được enable đúng region.
- Customer có thể chọn MoMo tại checkout.
- Backend tạo payment request thành công với MoMo sandbox.
- Customer có thể hoàn tất sandbox payment.
- IPN signature được verify.
- IPN duplicate không tạo duplicate payment/capture.
- Amount/order/payment identity được verify server-side.
- Medusa payment chuyển đúng lifecycle.
- Payment thành công được persist/audit trong DB.
- Missing IPN có thể được reconciliation.
- Refund flow đã được test nếu API/version hỗ trợ.
- Unit tests pass.
- Integration tests pass.
- Sandbox E2E pass.
- Production secrets không nằm trong source code.
- Logs/metrics đủ để debug payment.
- Có rollback strategy.
- `MOMO_PAYMENT_IMPLEMENTATION_GUIDE.md` hoàn chỉnh.

---

# FINAL GOAL

Mục tiêu cuối cùng không phải chỉ là **"MoMo chạy được"**.

Implementation phải đạt các tiêu chí:

**Correct**
→ Payment lifecycle đúng.

**Secure**
→ Signature, secrets, webhook và replay được xử lý an toàn.

**Idempotent**
→ Retry/duplicate không làm payment chạy hai lần.

**Auditable**
→ Có transaction/webhook/payment history để điều tra.

**Recoverable**
→ Mất IPN hoặc service restart vẫn có thể reconciliation.

**Testable**
→ Có unit, integration, sandbox và E2E tests.

**Maintainable**
→ Có thể mở rộng thêm VNPay/ZaloPay/payment provider khác mà không phá Bank Transfer.

**Deployable**
→ Có quy trình rõ ràng từ:

`Local Development → MoMo Sandbox → Staging → Production`

Trước khi viết code, hãy trả về **Audit + Architecture + Implementation Plan** để review. Chỉ bắt đầu implementation sau khi plan đã rõ ràng.
