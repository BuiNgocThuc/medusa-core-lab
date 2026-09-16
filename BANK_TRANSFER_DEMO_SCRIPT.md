# Bank Transfer Demo Script

Tài liệu này là kịch bản demo Bank Transfer cho sếp hoặc stakeholder không cần đọc sâu code. Mục tiêu là cho thấy khách có thể đặt hàng bằng chuyển khoản ngân hàng, hệ thống sinh mã tham chiếu riêng, nhận webhook giao dịch, tự đối soát và cập nhật payment/order.

## 1. Thông điệp chính khi mở demo

Nói ngắn gọn:

> Đây là prototype Bank Transfer cho Medusa. Khách chọn chuyển khoản, hệ thống sinh nội dung chuyển khoản riêng cho đơn hàng. Khi ngân hàng gửi webhook giao dịch về, backend tự match theo reference, amount và currency. Giao dịch đúng thì payment được xác nhận; giao dịch trùng, sai tiền hoặc không tìm thấy reference sẽ được ghi vào ledger để đối soát.

Điểm nên nhấn mạnh:

- Không phải card payment.
- Khách không nhập thẻ.
- Khách chuyển khoản qua app ngân hàng ngoài đời thật.
- Demo hiện dùng `Demo Bank` và webhook giả lập.
- Trong production có thể thay bằng tài khoản ngân hàng thật, VietQR, webhook ngân hàng hoặc hệ thống đọc sao kê.

## 2. Mục tiêu demo

Sau demo, người xem cần hiểu được 5 thứ:

1. Checkout có thêm phương thức `Bank Transfer`.
2. Mỗi payment session có một `payment_reference` riêng, ví dụ `PAY FDXRBKDDA`.
3. Order được tạo ở trạng thái chờ thanh toán.
4. Webhook bank gửi giao dịch về backend.
5. Backend tự xử lý:
   - đúng tiền -> matched -> payment confirmed/captured
   - trùng transaction -> duplicate
   - sai reference -> unmatched
   - dư/thiếu tiền -> manual review

## 3. Chuẩn bị trước demo

### 3.1. Kiểm tra infra

```bash
docker compose up -d
```

### 3.2. Chạy migration

```bash
cd my-medusa-store
pnpm --filter @dtc/backend exec medusa db:migrate
```

### 3.3. Bật provider cho VND region

```bash
cd my-medusa-store
pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/enable-bank-transfer-provider.ts
```

Expected:

```text
[bank-transfer] Enabled pp_bank-transfer_default for 1 VND region(s).
```

### 3.4. Start backend

Nếu dùng port mặc định:

```bash
cd my-medusa-store
MEDUSA_ADMIN_DISABLED=true pnpm --filter @dtc/backend start
```

Nếu port `9001` đang bận, dùng `9101`:

```bash
cd my-medusa-store
PORT=9101 MEDUSA_ADMIN_DISABLED=true pnpm --filter @dtc/backend start
```

Trong tài liệu này mặc định backend demo là:

```text
http://localhost:9101
```

Nếu bạn chạy port khác, đổi URL trong các command webhook.

### 3.5. Start storefront

Chạy storefront theo command dev hiện tại của project. Sau đó mở checkout trên browser.

Ghi chú: demo này chủ yếu trình bày UI checkout và backend webhook. Nếu không kịp mở storefront, vẫn có thể demo bằng API/curl, nhưng demo UI sẽ dễ hiểu hơn cho sếp.

## 4. Demo Flow A - Khách chọn Bank Transfer ở checkout

### Bước A1: Vào checkout

Thao tác:

1. Mở storefront.
2. Thêm một sản phẩm vào cart.
3. Điền email, shipping address, billing address.
4. Chọn shipping method.
5. Đến bước Payment.

Lời thoại:

> Ở bước Payment, ngoài Manual Payment test của Medusa, hệ thống có thêm Bank Transfer. Đây là custom payment provider mình gắn vào Medusa Payment Module.

### Bước A2: Chọn Bank Transfer

Khi chọn Bank Transfer, màn hình sẽ hiển thị thông tin kiểu:

```text
Amount:          ₫410,000
Reference:       PAY FDXRBKDDA
Bank:            Demo Bank
Account number:  0000000000
Account name:    MEDUSA DEMO MERCHANT
Expires:         Sep 14, 2026, 3:56 PM
```

Lời thoại:

> Hệ thống đã tạo một payment session và sinh reference riêng cho cart này. Khách sẽ chuyển đúng số tiền và nhập đúng nội dung chuyển khoản là reference này. Reference là chìa khóa để backend match giao dịch ngân hàng với order.

Điểm cần nói rõ:

- `Demo Bank` là dữ liệu dev từ `.env`.
- Production sẽ thay bằng tài khoản thật.
- Có thể thêm VietQR để khách scan thay vì copy tay.

### Bước A3: Place order

Click:

```text
Place order and pay by bank transfer
```

Lời thoại:

> Với chuyển khoản ngân hàng, tiền chưa về ngay tại thời điểm bấm đặt hàng. Vì vậy order được tạo trước, payment session ở trạng thái pending authorization. Khi webhook ngân hàng báo tiền về, hệ thống mới xác nhận payment.

Expected:

- Order được tạo.
- Payment chưa captured ngay.
- Ledger có một `bank_payment_reference` status `pending`.

## 5. Demo Flow B - Giả lập tiền về đúng

Sau khi có `payment_reference` trên UI, copy reference đó. Ví dụ:

```text
PAY FDXRBKDDA
```

Copy amount đúng từ UI. Ví dụ:

```text
410000
```

### Bước B1: Gửi webhook giả lập bank

Demo dùng route chuẩn của Medusa:

```bash
curl -X POST "http://localhost:9101/hooks/payment/bank-transfer_default" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt_demo_success_001",
    "transaction_id": "bank_txn_demo_success_001",
    "amount": 410000,
    "currency_code": "vnd",
    "description": "Thanh toan PAY FDXRBKDDA",
    "payment_reference": "PAY FDXRBKDDA"
  }'
```

Nếu backend có `BANK_TRANSFER_WEBHOOK_SECRET`, thêm header:

```bash
-H "x-bank-signature: <secret>"
```

Expected response:

```json
{
  "status": "matched",
  "process_payment": true,
  "payment_session_id": "payses_...",
  "payment_reference": "PAY FDXRBKDDA"
}
```

Lời thoại:

> Đây là webhook giả lập từ ngân hàng. Trong production, payload này sẽ đến từ bank hoặc từ hệ thống đọc sao kê. Backend nhận transaction id, amount, currency và nội dung chuyển khoản, sau đó đối chiếu với reference đang pending.

### Bước B2: Giải thích backend làm gì

Lời thoại:

> Backend ghi lại webhook event trước để audit. Sau đó kiểm tra transaction id đã từng xử lý chưa. Nếu chưa, hệ thống tìm reference `PAY FDXRBKDDA`, so số tiền `410000` và currency `vnd`. Nếu tất cả khớp, transaction được mark `matched`, reference được mark `matched`, và Medusa payment được chuyển sang authorized qua route webhook chuẩn.

Data được ghi:

```text
bank_webhook_event   -> processed
bank_transaction     -> matched
bank_payment_reference -> matched
payment authorized   -> true
```

## 6. Demo Flow C - Gửi lại cùng transaction để chứng minh idempotency

Chạy lại cùng command ở Flow B, giữ nguyên:

```text
transaction_id = bank_txn_demo_success_001
```

Expected response:

```json
{
  "status": "duplicate",
  "process_payment": false
}
```

Lời thoại:

> Webhook ngân hàng có thể gửi lại cùng một event nhiều lần. Hệ thống dùng external transaction id để chống xử lý trùng. Cùng một transaction id sẽ bị mark duplicate và không xử lý payment lần hai.

## 7. Demo Flow D - Sai reference hoặc không tìm thấy order

Gửi một webhook với reference không tồn tại:

```bash
curl -X POST "http://localhost:9101/hooks/payment/bank-transfer_default" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt_demo_unmatched_001",
    "transaction_id": "bank_txn_demo_unmatched_001",
    "amount": 410000,
    "currency_code": "vnd",
    "description": "Thanh toan PAY UNKNOWN999",
    "payment_reference": "PAY UNKNOWN999"
  }'
```

Expected response:

```json
{
  "status": "unmatched",
  "process_payment": false,
  "payment_reference": "PAY UNKNOWN999",
  "reason": "No pending payment reference matched the transfer"
}
```

Lời thoại:

> Nếu khách chuyển khoản nhưng nhập sai nội dung, hệ thống vẫn ghi nhận giao dịch nhưng không tự gán cho order nào. Đây là case cần reconciliation/manual review.

## 8. Demo Flow E - Sai số tiền

Dùng reference mới còn pending, rồi gửi amount nhỏ hơn hoặc lớn hơn. Nếu muốn demo cả underpaid và overpaid, tạo 2 order/reference khác nhau, vì sau khi một reference bị mark `underpaid` hoặc `overpaid`, nó không còn là `pending` nữa.

Underpaid:

```bash
curl -X POST "http://localhost:9101/hooks/payment/bank-transfer_default" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt_demo_underpaid_001",
    "transaction_id": "bank_txn_demo_underpaid_001",
    "amount": 400000,
    "currency_code": "vnd",
    "description": "Thanh toan PAY <REFERENCE>",
    "payment_reference": "PAY <REFERENCE>"
  }'
```

Expected:

```json
{
  "status": "underpaid",
  "process_payment": false
}
```

Overpaid:

```bash
curl -X POST "http://localhost:9101/hooks/payment/bank-transfer_default" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt_demo_overpaid_001",
    "transaction_id": "bank_txn_demo_overpaid_001",
    "amount": 420000,
    "currency_code": "vnd",
    "description": "Thanh toan PAY <REFERENCE>",
    "payment_reference": "PAY <REFERENCE>"
  }'
```

Expected:

```json
{
  "status": "overpaid",
  "process_payment": false
}
```

Lời thoại:

> Sai số tiền không được auto confirm. Hệ thống đưa vào trạng thái cần kiểm tra tay. Đây là điểm quan trọng để tránh tự động ghi nhận sai payment.

## 9. Demo route chuẩn Medusa

Nếu muốn nói về mức độ bám docs Medusa, demo thêm route chuẩn:

```bash
curl -X POST "http://localhost:9101/hooks/payment/bank-transfer_default" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt_demo_standard_001",
    "transaction_id": "bank_txn_demo_standard_001",
    "amount": 410000,
    "currency_code": "vnd",
    "description": "Thanh toan PAY <REFERENCE>",
    "payment_reference": "PAY <REFERENCE>"
  }'
```

Lời thoại:

> Đây là route chuẩn của Medusa Payment Module. Nó gọi `getWebhookActionAndData()` trong provider. Provider dùng cùng ledger matching rồi trả action `authorized` cho Medusa.

Ghi chú khi demo:

- Không dùng cùng một reference đã matched ở Flow B.
- Tạo cart/order mới nếu muốn demo route chuẩn.
- Route custom đã bỏ; chỉ dùng route chuẩn để tránh hai đường webhook cùng mutate trạng thái payment.

## 10. SQL kiểm tra sau demo

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
  matched_at
from bank_payment_reference
order by created_at desc
limit 10;
```

Kiểm tra transaction:

```sql
select
  external_transaction_id,
  payment_reference,
  payment_session_id,
  amount,
  currency_code,
  status,
  processed_at
from bank_transaction
order by created_at desc
limit 20;
```

Kiểm tra webhook event:

```sql
select
  event_id,
  external_transaction_id,
  status,
  error_message,
  processed_at
from bank_webhook_event
order by created_at desc
limit 20;
```

Kiểm tra payment đã capture:

```sql
select
  id,
  payment_session_id,
  amount,
  currency_code,
  captured_at
from payment
order by created_at desc
limit 10;
```

## 11. Câu trả lời cho các câu hỏi sếp có thể hỏi

### Đây đã kết nối ngân hàng thật chưa?

Chưa. Hiện là prototype provider và webhook contract. Nó đã có đủ logic lõi: reference, amount matching, duplicate transaction, pending authorization và reconciliation. Kết nối thật sẽ thay webhook giả lập bằng webhook/polling từ bank.

### Vì sao cần reference?

Vì một tài khoản ngân hàng nhận tiền từ nhiều khách. Reference là khóa để biết giao dịch này thuộc order nào.

### Nếu khách chuyển sai nội dung thì sao?

Giao dịch vào `unmatched`. Hệ thống không tự confirm order. Nhân sự vận hành có thể review và gán tay sau.

### Nếu khách chuyển thiếu hoặc dư tiền?

Giao dịch vào `underpaid` hoặc `overpaid`. Hệ thống không auto capture, cần manual review.

### Nếu ngân hàng gửi webhook lặp lại?

Hệ thống dùng `transaction_id` unique để phát hiện `duplicate`, không capture hai lần.

### Có an toàn để lên production chưa?

Chưa ngay lập tức. Cần thêm:

- Signature chuẩn theo ngân hàng thật, thường là HMAC hoặc public key.
- VietQR hoặc QR bank app để giảm nhập sai reference.
- Admin UI reconciliation.
- Alert/manual action cho `unmatched`, `underpaid`, `overpaid`.
- Monitoring webhook failure/retry.
- Secret management production.

## 12. Demo checklist nhanh

Trước khi demo:

- Backend chạy.
- Storefront chạy.
- Region có `pp_bank-transfer_default`.
- Có sản phẩm còn stock.
- Checkout tạo được Bank Transfer session.
- Copy đúng `payment_reference`.
- Copy đúng amount dạng số nguyên, ví dụ `410000`.

Trong demo:

- Show Bank Transfer UI.
- Place order.
- Gửi webhook matched.
- Gửi duplicate.
- Gửi unmatched.
- Giải thích ledger/reconciliation.

Kết demo bằng câu:

> Prototype này chứng minh Medusa có thể nhận Bank Transfer theo mô hình async payment: order tạo trước, tiền về sau, backend tự đối soát và chỉ xác nhận payment khi giao dịch ngân hàng khớp đủ reference, amount và currency.
