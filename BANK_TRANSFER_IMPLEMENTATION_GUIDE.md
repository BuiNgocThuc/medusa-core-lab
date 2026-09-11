# Bank Transfer Provider - Implementation Guide

Tài liệu này giải thích toàn bộ quá trình triển khai Bank Transfer provider cho MedusaJS trong repo này: kiến trúc, các file cần review, luồng checkout, luồng webhook, reconciliation, duplicate transaction, pending authorization và cách test lại từ đầu.

## 1. Mục tiêu của provider

Bank Transfer là payment provider nhỏ nhưng dạy được gần đủ các bài quan trọng khi làm payment thật:

- Tạo payment reference riêng cho từng payment session.
- Hiển thị thông tin chuyển khoản cho khách ở checkout.
- Cho phép order được tạo ở trạng thái chờ thanh toán.
- Nhận webhook từ ngân hàng hoặc hệ thống giả lập bank.
- Match giao dịch ngân hàng với order bằng reference, amount và currency.
- Chặn duplicate transaction bằng external transaction id.
- Không overwrite reference đã matched khi có giao dịch đến sau.
- Ghi ledger để reconciliation và audit.
- Đưa payment của Medusa qua đúng lifecycle: pending authorization -> authorized -> captured.

Điểm quan trọng: trong Bank Transfer, khách đặt hàng trước, tiền về sau. Vì vậy lúc checkout, provider chưa thể authorized/captured ngay như card payment.

## 2. Các file chính cần review

Đọc theo thứ tự này sẽ dễ hiểu nhất.

1. Backend config:
   - `my-medusa-store/apps/backend/medusa-config.ts`
   - Đăng ký custom ledger module `bank-transfer-payment`.
   - Đăng ký payment provider `bank-transfer`.
   - Truyền option ngân hàng từ environment variables.
   - Có `MEDUSA_ADMIN_DISABLED=true` để chạy API-only khi test không cần build Admin.

2. Payment provider:
   - `my-medusa-store/apps/backend/src/modules/bank-transfer/index.ts`
   - `my-medusa-store/apps/backend/src/modules/bank-transfer/service.ts`
   - `my-medusa-store/apps/backend/src/modules/bank-transfer/types.ts`
   - Đây là lớp Medusa Payment Provider thật sự. Nó chịu trách nhiệm tạo session, authorize, capture, refund/cancel giả lập và trả status payment cho Medusa.

3. Ledger module:
   - `my-medusa-store/apps/backend/src/modules/bank-transfer-payment/index.ts`
   - `my-medusa-store/apps/backend/src/modules/bank-transfer-payment/service.ts`
   - `my-medusa-store/apps/backend/src/modules/bank-transfer-payment/types.ts`
   - Đây là module nghiệp vụ riêng để lưu reference, transaction và webhook event.

4. Ledger models:
   - `my-medusa-store/apps/backend/src/modules/bank-transfer-payment/models/bank-payment-reference.ts`
   - `my-medusa-store/apps/backend/src/modules/bank-transfer-payment/models/bank-transaction.ts`
   - `my-medusa-store/apps/backend/src/modules/bank-transfer-payment/models/bank-webhook-event.ts`
   - Ba bảng này là nền tảng reconciliation.

5. Migration:
   - `my-medusa-store/apps/backend/src/modules/bank-transfer-payment/migrations/Migration20260910111430.ts`
   - Tạo 3 bảng ledger và indexes.

6. Webhook route:
   - `my-medusa-store/apps/backend/src/api/webhooks/payments/bank/route.ts`
   - Nhận webhook ngân hàng, gọi ledger match, rồi gọi `processPaymentWorkflow`.

7. Expiry job:
   - `my-medusa-store/apps/backend/src/jobs/expire-bank-transfer-payments.ts`
   - Mỗi 5 phút expire reference đang pending nếu quá hạn.

8. Region/provider enable script:
   - `my-medusa-store/apps/backend/src/migration-scripts/enable-bank-transfer-provider.ts`
   - Bật `pp_bank-transfer_default` cho các VND region đã seed sẵn.

9. Storefront:
   - `my-medusa-store/apps/storefront/src/lib/constants.tsx`
   - `my-medusa-store/apps/storefront/src/lib/data/cart.ts`
   - `my-medusa-store/apps/storefront/src/modules/checkout/components/payment/index.tsx`
   - `my-medusa-store/apps/storefront/src/modules/checkout/components/payment-button/index.tsx`
   - Hiển thị Bank Transfer ở checkout, render reference/bank account và cho phép place order khi payment vẫn chờ webhook.

## 3. Kiến trúc tổng quát

Luồng được chia thành 3 lớp:

```text
Storefront checkout
  -> Medusa Store API
  -> Bank Transfer Payment Provider
  -> Bank Transfer Payment Ledger Module
  -> Webhook / reconciliation
  -> Medusa processPaymentWorkflow
  -> Payment authorized + captured
```

Trong đó:

- Provider nói chuyện với Medusa payment lifecycle.
- Ledger module nói chuyện với dữ liệu thật cần audit.
- Webhook route là cầu nối từ bank transaction vào Medusa payment workflow.

Tách provider và ledger ra riêng để sau này có thể thay provider logic mà vẫn giữ lịch sử reconciliation ổn định.

## 4. Environment variables

Backend template đã có các biến chính trong:

```text
my-medusa-store/apps/backend/.env.template
```

Các biến Bank Transfer:

```bash
BANK_TRANSFER_BANK_NAME="Demo Bank"
BANK_TRANSFER_ACCOUNT_NUMBER="0000000000"
BANK_TRANSFER_ACCOUNT_NAME="MEDUSA DEMO MERCHANT"
BANK_TRANSFER_REFERENCE_PREFIX="PAY"
BANK_TRANSFER_EXPIRY_MINUTES=30
BANK_TRANSFER_WEBHOOK_SECRET=""
MEDUSA_ADMIN_DISABLED=false
```

Ghi chú:

- Nếu `BANK_TRANSFER_WEBHOOK_SECRET` có giá trị, webhook phải gửi header `x-bank-signature` đúng bằng secret đó.
- Nếu secret rỗng, webhook route cho phép gọi không cần signature để tiện dev.
- Không commit secret thật. File `.env` hiện có giá trị thật-looking như S3/Cloudflare; nếu repo từng được share hoặc commit public thì nên rotate key.

## 5. Provider id và cách Medusa nhìn thấy provider

Provider được đăng ký trong `medusa-config.ts`:

```text
pp_bank-transfer_default
```

Cách hình thành id:

- Service identifier trong provider: `bank-transfer`
- Provider config id: `default`
- Medusa tạo id cuối: `pp_bank-transfer_default`

Provider này phải được enable trong region thì Store API mới trả về ở:

```text
GET /store/payment-providers?region_id=<region_id>
```

Script bật provider:

```bash
pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/enable-bank-transfer-provider.ts
```

Script này bật cả:

```text
pp_system_default
pp_bank-transfer_default
```

cho mọi region có `currency_code = vnd`.

## 6. Bảng dữ liệu ledger

### bank_payment_reference

Mỗi payment session có một reference riêng.

Các cột quan trọng:

- `payment_reference`: nội dung chuyển khoản, ví dụ `PAY VZWJBJAV8`.
- `payment_session_id`: Medusa payment session id.
- `expected_amount`: số tiền cần nhận.
- `currency_code`: currency cần match.
- `status`: `pending`, `matched`, `underpaid`, `overpaid`, `expired`, `canceled`, `manual_review`.
- `matched_transaction_id`: external transaction id đã match.
- `received_amount`: số tiền thật nhận.
- `matched_at`: thời điểm match.

Unique quan trọng:

- `payment_reference` unique.
- `payment_session_id` unique.

Điều này đảm bảo một session chỉ có một reference đang được audit.

### bank_transaction

Mỗi giao dịch bank nhận từ webhook được ghi vào đây.

Các cột quan trọng:

- `external_transaction_id`: id giao dịch từ bank, unique.
- `payment_reference`: reference parse được hoặc gửi trực tiếp.
- `payment_session_id`: session được match nếu có.
- `amount`, `currency_code`, `description`.
- `status`: `matched`, `duplicate`, `underpaid`, `overpaid`, `unmatched`, `expired`, `failed`, `ignored`.
- `raw_payload`: payload gốc để audit.

Unique quan trọng:

- `external_transaction_id` unique để chặn duplicate transaction.

### bank_webhook_event

Mỗi lần webhook gọi vào đều được ghi event.

Các cột quan trọng:

- `event_id`: optional event id từ bank.
- `external_transaction_id`: transaction id từ bank.
- `status`: `received`, `processed`, `ignored`, `failed`.
- `raw_payload`, `headers`.
- `error_message`.

Bảng này giúp trả lời câu hỏi: "Webhook nào đã tới, được xử lý ra sao, có lỗi không?"

## 7. Luồng checkout chi tiết

### Bước 1: Storefront lấy payment providers

Checkout gọi Store API để lấy providers theo region. Khi Bank Transfer đã enable, danh sách có:

```text
pp_bank-transfer_default
pp_system_default
```

Storefront map provider trong:

```text
my-medusa-store/apps/storefront/src/lib/constants.tsx
```

### Bước 2: Khách chọn Bank Transfer

Component:

```text
my-medusa-store/apps/storefront/src/modules/checkout/components/payment/index.tsx
```

Khi chọn Bank Transfer, storefront gọi:

```text
initiatePaymentSession(cart, { provider_id: "pp_bank-transfer_default" })
```

### Bước 3: Provider tạo payment session

File:

```text
my-medusa-store/apps/backend/src/modules/bank-transfer/service.ts
```

Method chính:

```text
initiatePayment()
```

Provider làm các việc:

- Lấy `session_id` từ data của Medusa.
- Sinh reference dạng `PAY <CODE>`.
- Tính expiry time.
- Trả session data cho storefront:
  - bank name
  - account number
  - account name
  - amount
  - currency
  - payment reference
  - expires_at
  - instructions
- Gọi ledger module `upsertReferenceFromSession()` để lưu reference.

Status trả về:

```text
pending
```

### Bước 4: Storefront hiển thị thông tin chuyển khoản

Storefront render:

- Amount
- Reference
- Bank
- Account number
- Account name
- Expires

Khách phải chuyển đúng:

```text
amount + currency + reference
```

### Bước 5: Place order

Button Bank Transfer nằm ở:

```text
my-medusa-store/apps/storefront/src/modules/checkout/components/payment-button/index.tsx
```

Nó gọi:

```text
placeOrder()
```

Lúc này tiền chưa về, nên provider `authorizePayment()` trả:

```text
pending_authorization
```

Kết quả đúng là order được tạo nhưng payment chưa captured.

## 8. Luồng webhook và reconciliation

Webhook endpoint:

```text
POST /webhooks/payments/bank
```

Payload dev/test:

```json
{
  "event_id": "evt_bank_001",
  "transaction_id": "bank_txn_001",
  "amount": 3830000,
  "currency_code": "vnd",
  "description": "Thanh toan PAY VZWJBJAV8",
  "payment_reference": "PAY VZWJBJAV8"
}
```

`payment_reference` là optional. Nếu không gửi, service sẽ cố parse reference từ `description`.

### Bước 1: Webhook validate input

Route yêu cầu:

- `transaction_id`
- `amount`
- `currency_code`

Nếu `BANK_TRANSFER_WEBHOOK_SECRET` có set, route yêu cầu:

```text
x-bank-signature: <secret>
```

### Bước 2: Ghi bank_webhook_event

Ngay khi nhận webhook, ledger module tạo event status:

```text
received
```

### Bước 3: Chặn duplicate transaction

Service kiểm tra:

```text
bank_transaction.external_transaction_id
```

Nếu transaction id đã tồn tại:

- Webhook event được mark `ignored`.
- Không tạo payment/capture lần nữa.
- Response trả `status: duplicate`.

Đây là cơ chế idempotency chính.

### Bước 4: Tìm reference

Reference được lấy theo thứ tự:

1. `payment_reference` từ payload.
2. Parse từ `description`, ví dụ `PAY VZWJBJAV8`.

Nếu không tìm thấy reference:

- Ghi `bank_transaction` status `unmatched`.
- Mark event `processed`.
- Không gọi payment workflow.

### Bước 5: Match amount/currency/status

Nếu tìm thấy reference, ledger tính status:

- Reference không còn `pending` -> `ignored`.
- Reference đã hết hạn -> `expired`.
- Currency khác -> `unmatched`.
- Amount nhỏ hơn expected -> `underpaid`.
- Amount lớn hơn expected -> `overpaid`.
- Amount bằng expected và currency đúng -> `matched`.

Chỉ status `matched` mới được tự động process payment.

Các status còn lại để reconciliation/manual review.

### Bước 6: Update reference

Nếu transaction status không phải `ignored`, service update reference:

- `status`
- `matched_transaction_id`
- `received_amount`
- `matched_at`

Trường hợp quan trọng: nếu reference đã `matched` rồi mà có thêm giao dịch cùng reference nhưng transaction id khác, status là `ignored` và code không overwrite `matched_transaction_id` cũ. Nhờ đó transaction đầu tiên vẫn là source of truth.

### Bước 7: Process Medusa payment

Nếu status là `matched`, webhook route gọi:

```text
processPaymentWorkflow(action: "authorized")
processPaymentWorkflow(action: "captured")
```

Phải làm 2 bước vì order Bank Transfer được tạo với pending authorization. Nếu nhảy thẳng sang `captured`, Medusa chưa có payment id để capture và có thể lỗi kiểu:

```text
payment - id must be defined
```

Vì vậy thứ tự đúng là:

```text
pending_authorization -> authorized -> captured
```

Sau bước này bảng `payment` của Medusa có `captured_at`.

## 9. Vai trò của authorizePayment và getPaymentStatus

Trong provider:

```text
authorizePayment()
getPaymentStatus()
```

Hai method này đọc ledger theo `payment_session_id`.

Nếu reference đã `matched`, provider trả:

```text
authorized
```

Không trả `captured` ngay trong `authorizePayment()`, vì captured cần đi qua Medusa workflow capture để tạo payment record đúng cách.

## 10. Expiry job

File:

```text
my-medusa-store/apps/backend/src/jobs/expire-bank-transfer-payments.ts
```

Config:

```text
*/5 * * * *
```

Nghĩa là mỗi 5 phút job gọi:

```text
expirePendingReferences()
```

Reference nào:

- status `pending`
- `expires_at <= now`

sẽ thành:

```text
expired
```

Giao dịch tới sau expiry sẽ không auto capture.

## 11. Các trạng thái cần nhớ

Reference status:

```text
pending
matched
underpaid
overpaid
expired
canceled
manual_review
```

Transaction status:

```text
matched
duplicate
underpaid
overpaid
unmatched
expired
failed
ignored
```

Webhook event status:

```text
received
processed
ignored
failed
```

Rule vận hành:

- `matched`: auto authorize + capture.
- `duplicate`: bỏ qua, không thu tiền hai lần.
- `ignored`: giao dịch có reference nhưng reference không còn pending.
- `underpaid` / `overpaid`: không auto capture, cần xử lý tay.
- `unmatched`: tiền về nhưng không tìm thấy order/reference.
- `expired`: reference quá hạn, không auto capture.

## 12. Cách chạy lại từ đầu

### 12.1. Start infra

```bash
docker compose up -d
```

### 12.2. Chạy migration

```bash
cd my-medusa-store
pnpm --filter @dtc/backend exec medusa db:migrate
```

### 12.3. Enable Bank Transfer provider cho VND region

```bash
cd my-medusa-store
pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/enable-bank-transfer-provider.ts
```

Expected log:

```text
[bank-transfer] Enabled pp_bank-transfer_default for 1 VND region(s).
```

### 12.4. Typecheck và build

```bash
cd my-medusa-store
pnpm --filter @dtc/backend exec tsc --noEmit
pnpm --filter @dtc/storefront exec tsc --noEmit
pnpm --filter @dtc/backend build
```

Build hiện có một vài warning seed script cũ, không liên quan Bank Transfer:

- `seed/customers.ts`: warning logger token.
- `seed/orders.ts`: warning logger token.
- `seed/stock-and-shipping.ts`: warning price smallest currency unit.

### 12.5. Start backend API-only để test

Nếu port 9001 đang bị process dev cũ giữ, dùng 9101:

```bash
cd my-medusa-store
PORT=9101 MEDUSA_ADMIN_DISABLED=true pnpm --filter @dtc/backend start
```

Nếu dùng port mặc định:

```bash
cd my-medusa-store
MEDUSA_ADMIN_DISABLED=true pnpm --filter @dtc/backend start
```

## 13. Manual API test flow

Flow đã test thành công bằng Store API như sau:

1. Lấy region:

```text
GET /store/regions
```

2. Lấy payment providers:

```text
GET /store/payment-providers?region_id=<region_id>
```

Expected:

```text
pp_bank-transfer_default
pp_system_default
```

3. Tạo cart:

```text
POST /store/carts
```

4. Add item vào cart.

5. Set shipping/billing address.

6. Add shipping method.

7. Create payment collection:

```text
POST /store/payment-collections
```

8. Create payment session:

```text
POST /store/payment-collections/<payment_collection_id>/payment-sessions
```

Body:

```json
{
  "provider_id": "pp_bank-transfer_default"
}
```

Expected session:

```text
status = pending
data.payment_reference = PAY ...
data.session_id = payses_...
```

9. Complete cart:

```text
POST /store/carts/<cart_id>/complete
```

Expected:

```text
type = order
order status = pending
```

10. Gửi webhook matched:

```bash
curl -X POST "http://localhost:9101/webhooks/payments/bank" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt_bank_manual_001",
    "transaction_id": "bank_txn_manual_001",
    "amount": 3830000,
    "currency_code": "vnd",
    "description": "Thanh toan PAY VZWJBJAV8",
    "payment_reference": "PAY VZWJBJAV8"
  }'
```

Nếu `BANK_TRANSFER_WEBHOOK_SECRET` có set trong backend `.env`, thêm header này vào command:

```bash
-H "x-bank-signature: <secret>"
```

Expected:

```json
{
  "status": "matched",
  "process_payment": true,
  "payment_session_id": "payses_...",
  "payment_reference": "PAY ..."
}
```

11. Gửi lại cùng `transaction_id`.

Expected:

```json
{
  "status": "duplicate",
  "process_payment": false
}
```

12. Gửi transaction id mới nhưng cùng reference đã matched.

Expected:

```json
{
  "status": "ignored",
  "process_payment": false
}
```

13. Gửi reference không tồn tại.

Expected:

```json
{
  "status": "unmatched",
  "process_payment": false
}
```

## 14. Kết quả full-flow test đã chạy

Test backend API-only trên port `9101`, không đụng process đang giữ port `9001`.

Kết quả:

- Region: `reg_01M22500GBZGKE1PR303861BJV`
- Providers trả về: `pp_bank-transfer_default`, `pp_system_default`
- Product variant test: `variant_01M22500WNKVM5N92N10Q06ZTY`
- Cart: `cart_01M25JGYBQ06FS49MCPMJ3AYDQ`
- Payment collection: `pay_col_01M25JGZGXTDZS0VZ0ZBYGYKTX`
- Payment session: `payses_01M25JGZJVWGC1Q5Y8R50RP74J`
- Reference: `PAY VZWJBJAV8`
- Amount: `3830000`
- Currency: `vnd`
- Order: `order_01M25JGZRDCKZBF7BNPMVYHQVT`
- Matched transaction: `bank_txn_1789041082324`
- Medusa payment: `pay_01M25JH00FN3AKDCEWC995AQ53`
- `payment.captured_at` đã có giá trị.

Webhook scenarios đã test:

- Exact match -> `matched`, `process_payment: true`.
- Replay same transaction id -> `duplicate`, `process_payment: false`.
- Second transfer same reference -> `ignored`, `process_payment: false`.
- Unknown reference -> `unmatched`, `process_payment: false`.

DB verification:

```text
payment_session_id = payses_01M25JGZJVWGC1Q5Y8R50RP74J
payment amount     = 3830000
currency           = vnd
captured_at        = not null
```

Ledger verification:

```text
bank_payment_reference.status = matched
matched_transaction_id        = bank_txn_1789041082324
received_amount               = 3830000
```

Second transaction with same reference was stored as:

```text
status = ignored
```

and did not overwrite the original matched reference.

## 15. SQL hữu ích khi review

Kiểm tra reference:

```sql
select
  payment_reference,
  payment_session_id,
  status,
  matched_transaction_id,
  expected_amount,
  received_amount,
  currency_code,
  expires_at,
  matched_at
from bank_payment_reference
order by created_at desc
limit 20;
```

Kiểm tra transactions:

```sql
select
  external_transaction_id,
  payment_reference,
  payment_session_id,
  amount,
  currency_code,
  status,
  received_at,
  processed_at
from bank_transaction
order by created_at desc
limit 50;
```

Kiểm tra webhook events:

```sql
select
  event_id,
  external_transaction_id,
  status,
  error_message,
  processed_at,
  created_at
from bank_webhook_event
order by created_at desc
limit 50;
```

Kiểm tra Medusa payment đã capture:

```sql
select
  id,
  payment_session_id,
  amount,
  currency_code,
  captured_at
from payment
where payment_session_id = '<payses_id>';
```

## 16. Các case nên tự test thêm

1. Underpaid:
   - Gửi amount nhỏ hơn expected.
   - Expected: `bank_transaction.status = underpaid`, reference `underpaid`, không capture.

2. Overpaid:
   - Gửi amount lớn hơn expected.
   - Expected: `overpaid`, không capture.

3. Wrong currency:
   - Gửi `currency_code = usd` cho reference VND.
   - Expected: `unmatched`, không capture.

4. Expired:
   - Set expiry ngắn, đợi job chạy hoặc update `expires_at` trong DB.
   - Gửi webhook sau expiry.
   - Expected: `expired`, không capture.

5. Missing reference:
   - Không gửi `payment_reference`, description không chứa `PAY ...`.
   - Expected: `unmatched`.

6. Duplicate:
   - Gửi cùng `transaction_id` hai lần.
   - Expected lần hai: `duplicate`, không tạo payment/capture lại.

## 17. Những điểm cần nhớ khi mở rộng thành bank thật

- Signature hiện là shared secret đơn giản cho dev. Bank thật thường dùng HMAC hoặc public/private key signature.
- Amount đang dùng integer theo cách Medusa/store đang dùng cho VND. Với currency có decimals cần thống nhất smallest unit.
- Refund hiện là manual-required metadata, chưa gọi API ngân hàng.
- Reconciliation admin UI chưa có. Hiện xem qua DB.
- `bank_webhook_event` nên có retry/error path tốt hơn nếu tích hợp bank thật.
- Có thể thêm command/manual action để admin xử lý `underpaid`, `overpaid`, `unmatched`.
- Có thể thêm notification/email cho khách sau khi payment matched.

## 18. Tóm tắt bằng một câu

Bank Transfer provider trong repo này hoạt động theo mô hình: checkout tạo reference và order chờ thanh toán, webhook ngân hàng ghi ledger và match giao dịch, sau đó Medusa payment được chuyển từ pending authorization sang authorized rồi captured một cách idempotent.
