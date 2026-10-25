# Payment Flow Deep Review

Updated: 2026-09-22

Tài liệu này review toàn bộ luồng payment trong repo `my-medusa-store`: checkout trên storefront, Medusa Payment Module, custom providers, ledger/audit modules, webhook/return flow, refund flow, Admin UI và cách đọc code để tự debug.

Nên đọc tài liệu này sau hoặc song song với `BANK_TRANSFER_IMPLEMENTATION_GUIDE.md`. File bank-transfer cũ đi sâu vào một provider cụ thể; file này là bản đồ tổng thể của toàn bộ payment system.

## 1. Mục Tiêu Payment System Hiện Tại

Repo hiện có nhiều phương thức thanh toán:

- Manual/test payment của Medusa.
- Bank Transfer custom provider.
- MoMo custom provider.
- VNPay custom provider.
- VNPay refund thật qua API `merchant_webapi/api/transaction`.
- Admin widget riêng để thao tác và xem audit refund VNPay.

Mục tiêu không chỉ là "cho khách trả tiền" mà còn là:

- Storefront chọn payment provider đúng theo region.
- Mỗi provider tạo payment session data riêng.
- Khách có UX phù hợp với từng loại payment.
- Redirect payment không được tin tuyệt đối từ browser.
- Backend phải xác minh chữ ký/webhook/gateway payload.
- Các sự kiện payment phải idempotent.
- Có bảng nội bộ để audit: đã tạo payment gì, webhook nào tới, refund nào đã gửi.
- Refund phải đi qua Medusa Payment workflow chuẩn để Medusa vẫn giữ ledger payment/refund đúng.

## 2. Bức Tranh Kiến Trúc

Luồng tổng quát:

```text
Storefront checkout
  -> Store API / payment session
  -> Medusa Payment Module
  -> Custom Payment Provider
  -> Provider-specific internal payment module
  -> External gateway or bank event
  -> Webhook/return reconciliation
  -> Medusa payment workflow
  -> Order/payment/refund state
```

Trong repo này có 2 lớp backend quan trọng:

1. Payment Provider module
   - Ví dụ: `src/modules/vnpay`, `src/modules/momo`, `src/modules/bank-transfer`.
   - Đây là adapter mà Medusa Payment Module gọi.
   - Nó implement các method như `initiatePayment`, `authorizePayment`, `capturePayment`, `refundPayment`, `getWebhookActionAndData`.

2. Provider ledger/audit module
   - Ví dụ: `src/modules/vnpay-payment`, `src/modules/momo-payment`, `src/modules/bank-transfer-payment`.
   - Đây là nơi lưu dữ liệu nghiệp vụ riêng của từng gateway.
   - Dùng để idempotency, reconciliation, audit và debug.

Tư duy chính: Medusa quản lý payment lifecycle chuẩn, còn bảng custom quản lý chi tiết cổng thanh toán.

## 3. File Nền Tảng Cần Đọc Trước

Đọc theo thứ tự này:

1. `my-medusa-store/apps/backend/medusa-config.ts`
   - Đăng ký custom modules.
   - Đăng ký providers vào `@medusajs/medusa/payment`.
   - Xem provider nào luôn bật, provider nào bật có điều kiện env.

2. `my-medusa-store/apps/storefront/src/modules/checkout/components/payment/index.tsx`
   - UI chọn payment method.
   - Khi chọn provider sẽ gọi `initiatePaymentSession`.
   - Hiển thị thông tin session data: reference bank, URL MoMo/VNPay, expiry.

3. `my-medusa-store/apps/storefront/src/modules/checkout/components/payment-button/index.tsx`
   - Nút cuối ở review step.
   - Quyết định: place order ngay, confirm Stripe, hay redirect sang MoMo/VNPay.

4. `my-medusa-store/apps/storefront/src/lib/data/cart.ts`
   - Server actions: `retrieveCart`, `initiatePaymentSession`, `placeOrder`.
   - `placeOrder()` gọi Medusa Store API complete cart.

5. Provider services:
   - `src/modules/bank-transfer/service.ts`
   - `src/modules/momo/service.ts`
   - `src/modules/vnpay/service.ts`

6. Ledger services:
   - `src/modules/bank-transfer-payment/service.ts`
   - `src/modules/momo-payment/service.ts`
   - `src/modules/vnpay-payment/service.ts`

7. Routes:
   - `src/api/hooks/payment/vnpay/route.ts`
   - Storefront return routes trong `apps/storefront/src/app/api/payment-return/...`
   - Admin custom route `src/api/admin/vnpay-refunds/route.ts`

8. Admin UI:
   - `src/admin/widgets/vnpay-refund-widget.tsx`

## 4. Provider IDs

Các provider id dùng trong storefront và Medusa:

```text
pp_bank-transfer_default
pp_momo_default
pp_vnpay_default
pp_medusa-payments_default
pp_system_default
```

Cách Medusa tạo provider id:

```text
pp_<provider static identifier>_<provider config id>
```

Ví dụ VNPay:

```text
static identifier = "vnpay"
config id = "default"
=> pp_vnpay_default
```

Các helper nhận diện provider nằm ở:

```text
my-medusa-store/apps/storefront/src/lib/constants.tsx
```

Các helper chính:

- `isBankTransfer(providerId)`
- `isMomo(providerId)`
- `isVnpay(providerId)`
- `isStripeLike(providerId)`
- `isManual(providerId)`

## 5. Backend Config

File:

```text
my-medusa-store/apps/backend/medusa-config.ts
```

Backend đăng ký 3 ledger modules:

```ts
{
  resolve: "./src/modules/bank-transfer-payment",
},
{
  resolve: "./src/modules/momo-payment",
},
{
  resolve: "./src/modules/vnpay-payment",
},
```

Sau đó đăng ký Payment Module chuẩn của Medusa:

```ts
{
  resolve: "@medusajs/medusa/payment",
  dependencies: [
    BANK_TRANSFER_PAYMENT_MODULE,
    MOMO_PAYMENT_MODULE,
    VNPAY_PAYMENT_MODULE,
  ],
  options: {
    providers: [...]
  },
}
```

Điểm cần hiểu:

- `bank-transfer` luôn được đăng ký.
- `momo` chỉ được đăng ký khi đủ env:
  - `MOMO_PARTNER_CODE`
  - `MOMO_ACCESS_KEY`
  - `MOMO_SECRET_KEY`
  - `MOMO_REDIRECT_URL`
  - `MOMO_IPN_URL`
- `vnpay` chỉ được đăng ký khi đủ env:
  - `VNPAY_TMN_CODE`
  - `VNPAY_HASH_SECRET`
  - `VNPAY_RETURN_URL`

Nếu checkout không thấy MoMo/VNPay:

1. Kiểm tra env có đủ không.
2. Restart backend.
3. Chạy script enable provider cho region.
4. Kiểm tra cart đang ở VND region.

## 6. Storefront Checkout Flow

### 6.1. Lấy cart

File:

```text
apps/storefront/src/lib/data/cart.ts
```

`retrieveCart()` lấy cart với fields:

```text
*items, *region, *items.product, *items.variant,
*items.thumbnail, *items.metadata, +items.total,
*promotions, +shipping_methods.name,
*payment_collection,
*payment_collection.payment_sessions
```

Quan trọng: checkout UI cần `payment_collection.payment_sessions` để biết provider nào đang active và session data của nó.

### 6.2. Hiển thị payment methods

File:

```text
apps/storefront/src/modules/checkout/components/payment/index.tsx
```

Component `Payment` nhận:

```ts
cart
availablePaymentMethods
```

Nó tìm active session:

```ts
paymentSession.status === "pending" ||
paymentSession.status === "pending_authorization"
```

Khi user chọn provider:

```ts
await initiatePaymentSession(cart, { provider_id: method })
```

Đây là điểm gọi Medusa Store API để Payment Module gọi provider `initiatePayment()`.

### 6.3. Chi tiết hiển thị theo provider

Bank Transfer:

- Hiện amount.
- Hiện payment reference.
- Hiện bank name/account/account name.
- Hiện expiry.

MoMo:

- Hiện amount.
- Hiện expiry.
- Hiện method `MoMo wallet`.
- Không auto mở gateway ở bước chọn payment.

VNPay:

- Hiện amount.
- Hiện expiry.
- Hiện method `VNPay gateway`.
- Không auto mở gateway ở bước chọn payment.

Điểm đúng về UX: chọn provider chỉ tạo session; trả tiền thật xảy ra ở review/final button.

### 6.4. Nút thanh toán cuối

File:

```text
apps/storefront/src/modules/checkout/components/payment-button/index.tsx
```

`PaymentButton` tìm active session rồi switch theo provider:

- Stripe-like: `stripe.confirmPayment(...)`, sau đó `placeOrder()`.
- Manual: gọi `placeOrder()`.
- Bank Transfer: gọi `placeOrder()` ngay, vì tiền về sau qua webhook.
- MoMo: redirect sang `pay_url` hoặc deeplink.
- VNPay: redirect sang `payment_url`.

Bank Transfer button:

```text
Place order and pay by bank transfer
```

MoMo button:

```text
Pay with MoMo
```

VNPay button:

```text
Pay with VNPay
```

## 7. Medusa Payment Lifecycle Trong Repo

Một provider custom phải hiểu các method này:

### `initiatePayment(input)`

Được gọi khi storefront tạo payment session.

Nhiệm vụ:

- Validate amount/currency.
- Tạo provider order/reference/session.
- Lưu bảng audit nội bộ.
- Trả về `status` và `data` cho payment session.

### `updatePayment(input)`

Được gọi khi cart thay đổi amount/currency.

Nhiệm vụ:

- Đồng bộ lại session data.
- Với Bank Transfer, nếu reference còn pending thì update expected amount.
- Với MoMo/VNPay hiện trả lại data updated nhưng không gọi gateway tạo payment mới.

### `authorizePayment(input)`

Được gọi khi Medusa muốn authorize payment.

Nhiệm vụ:

- Đọc bảng nội bộ theo `payment_session_id`.
- Nếu gateway đã xác nhận paid/matched thì trả `authorized`.
- Nếu chưa có xác nhận thì trả `pending_authorization`.
- Nếu payment fail thì trả `error`.

### `capturePayment(input)`

Được gọi khi Medusa capture payment.

Trong repo này các provider async thường đã nhận tiền trước khi gọi capture, nên `capturePayment` chủ yếu gắn metadata `captured_at`.

### `refundPayment(input)`

Được gọi khi Admin/API tạo refund qua Medusa.

Hiện trạng:

- Bank Transfer: manual required.
- MoMo: gọi MoMo refund API.
- VNPay: gọi VNPay refund API.

### `getWebhookActionAndData(payload)`

Medusa generic payment webhook route sẽ gọi method này.

Provider trả về action:

- `authorized`
- `captured`
- `failed`
- `not_supported`

Đây là cầu nối từ gateway event sang Medusa Payment workflow.

## 8. Bank Transfer Flow

### 8.1. Files

Provider:

```text
apps/backend/src/modules/bank-transfer/index.ts
apps/backend/src/modules/bank-transfer/service.ts
apps/backend/src/modules/bank-transfer/types.ts
```

Ledger module:

```text
apps/backend/src/modules/bank-transfer-payment/index.ts
apps/backend/src/modules/bank-transfer-payment/service.ts
apps/backend/src/modules/bank-transfer-payment/types.ts
apps/backend/src/modules/bank-transfer-payment/models/bank-payment-reference.ts
apps/backend/src/modules/bank-transfer-payment/models/bank-transaction.ts
apps/backend/src/modules/bank-transfer-payment/models/bank-webhook-event.ts
```

Job:

```text
apps/backend/src/jobs/expire-bank-transfer-payments.ts
```

### 8.2. Khi user chọn Bank Transfer

Storefront gọi:

```ts
initiatePaymentSession(cart, {
  provider_id: "pp_bank-transfer_default",
})
```

Medusa gọi:

```ts
BankTransferPaymentProviderService.initiatePayment()
```

Provider tạo:

- `payment_reference`, ví dụ `PAY ABC123XYZ`.
- `expires_at`.
- instruction chuyển khoản.
- record trong `bank_payment_reference`.

Payment session data trả về storefront gồm:

- `payment_reference`
- `bank_name`
- `bank_account_number`
- `bank_account_name`
- `amount`
- `currency_code`
- `expires_at`
- `instructions`

### 8.3. Khi user bấm final button

Bank Transfer không redirect.

Storefront gọi:

```ts
placeOrder()
```

Medusa complete cart. Vì provider chưa nhận tiền, `authorizePayment()` thường trả:

```text
pending_authorization
```

Order được tạo trong trạng thái chờ payment.

### 8.4. Webhook ngân hàng

Endpoint chuẩn:

```http
POST /hooks/payment/bank-transfer_default
```

Route này là generic Medusa payment webhook route, không nằm trực tiếp trong source custom. Medusa route sẽ gọi provider `getWebhookActionAndData()`.

Payload kỳ vọng:

```json
{
  "event_id": "evt_001",
  "event_type": "bank_transfer.succeeded",
  "transaction_id": "bank_txn_001",
  "amount": 3830000,
  "currency_code": "vnd",
  "description": "PAY ABC123XYZ",
  "payment_reference": "PAY ABC123XYZ"
}
```

Nếu `BANK_TRANSFER_WEBHOOK_SECRET` có cấu hình, request phải có:

```http
x-bank-signature: <secret>
```

### 8.5. Matching logic

File:

```text
bank-transfer-payment/service.ts
```

`matchIncomingTransfer()` làm các việc:

1. Ghi `bank_webhook_event`.
2. Check duplicate bằng `external_transaction_id`.
3. Lấy reference từ payload hoặc parse từ description.
4. Tìm `bank_payment_reference`.
5. So sánh:
   - reference status có còn `pending` không.
   - reference đã expired chưa.
   - currency có đúng không.
   - amount có bằng expected amount không.
6. Ghi `bank_transaction`.
7. Update `bank_payment_reference`.
8. Trả kết quả cho provider.

Chỉ status `matched` mới `process_payment: true`.

### 8.6. Action trả về Medusa

Nếu matched:

```ts
return {
  action: "authorized",
  data: {
    session_id,
    amount,
  },
}
```

Nếu duplicate, underpaid, overpaid, expired, unmatched:

```ts
return {
  action: "not_supported",
}
```

Bank Transfer hiện không auto-capture trong provider. Nếu business muốn auto-capture sau khi webhook matched, cần thêm workflow/job riêng.

## 9. MoMo Flow

### 9.1. Files

Provider:

```text
apps/backend/src/modules/momo/index.ts
apps/backend/src/modules/momo/service.ts
apps/backend/src/modules/momo/client.ts
apps/backend/src/modules/momo/crypto.ts
apps/backend/src/modules/momo/types.ts
```

Ledger module:

```text
apps/backend/src/modules/momo-payment/index.ts
apps/backend/src/modules/momo-payment/service.ts
apps/backend/src/modules/momo-payment/types.ts
apps/backend/src/modules/momo-payment/models/momo-payment.ts
apps/backend/src/modules/momo-payment/models/momo-webhook-event.ts
apps/backend/src/modules/momo-payment/models/momo-refund.ts
```

Reconciliation:

```text
apps/backend/src/jobs/reconcile-momo-payments.ts
```

### 9.2. Khi user chọn MoMo

Storefront gọi:

```ts
initiatePaymentSession(cart, {
  provider_id: "pp_momo_default",
})
```

Provider gọi:

```text
POST /v2/gateway/api/create
```

qua `MomoClient.createPayment()`.

Request được ký bằng HMAC SHA256 trong `momo/crypto.ts`.

Provider lưu `momo_payment`:

- `payment_session_id`
- `momo_order_id`
- `request_id`
- `amount`
- `currency_code`
- `status`
- `pay_url`
- `short_link`
- `deeplink`
- `qr_code_url`
- `raw_create_request`
- `raw_create_response`

Session data trả về storefront:

- `pay_url`
- `short_link`
- `deeplink`
- `qr_code_url`
- `momo_order_id`
- `request_id`
- `amount`
- `expires_at`

### 9.3. Khi user bấm Pay with MoMo

File:

```text
payment-button/index.tsx
```

Logic:

- Nếu mobile và có deeplink, dùng deeplink.
- Nếu không, dùng hosted payment URL.
- Thêm `cart_id` và `country_code` vào query để return route có context.
- Browser redirect sang MoMo.

### 9.4. MoMo IPN/Webhook

Endpoint chuẩn Medusa:

```http
POST /hooks/payment/momo_default
```

Provider implement `getWebhookActionAndData()` và `processIpn()`.

`processIpn()`:

1. Validate required fields.
2. Check `partnerCode`.
3. Build raw signature data.
4. Verify signature bằng `secretKey`.
5. Build `eventKey`.
6. Gọi `momoPaymentService.completePaymentFromIpn()`.

`completePaymentFromIpn()`:

- Chặn duplicate event bằng `event_key`.
- Tìm payment bằng `momo_order_id`.
- Check `request_id`.
- Check amount.
- Check final status.
- Nếu `result_code === 0`: mark `paid`, `process_payment: true`.
- Nếu `result_code === 9000`: mark `authorized`, `process_payment: true`.
- Pending result code: mark `pending`, không process payment.
- Fail code: mark `failed`.

Provider trả action:

- `captured` nếu result là paid.
- `authorized` nếu result là authorized.
- `failed` nếu failed.
- `not_supported` nếu không cần mutate Medusa.

### 9.5. MoMo return route storefront

File:

```text
apps/storefront/src/app/api/payment-return/momo/route.ts
```

Endpoint:

```http
GET /api/payment-return/momo
```

Hiện tại route này:

- Đọc `resultCode`.
- Nếu `resultCode === "0"` thì gọi `placeOrder()`.
- Nếu không thì redirect về checkout payment failed.

Review note quan trọng:

- Browser return chỉ là UX.
- Nguồn xác thực tốt hơn vẫn là IPN/backend reconciliation.
- Nếu return về trước IPN, `placeOrder()` có thể phụ thuộc vào trạng thái payment session hiện tại. Cần test race condition.

### 9.6. MoMo reconciliation job

File:

```text
apps/backend/src/jobs/reconcile-momo-payments.ts
```

Job lấy candidates pending/authorized rồi gọi MoMo query API để xác nhận lại, sau đó gọi `processPaymentWorkflow` nếu cần.

Job này là lớp bảo hiểm khi IPN bị mất hoặc return/IPN race.

### 9.7. MoMo refund

`MomoPaymentProviderService.refundPayment()`:

1. Lấy `amount`.
2. Tìm payment bằng `session_id`.
3. Lấy `trans_id`.
4. Gọi `MomoClient.refund()`.
5. Tạo record `momo_refund`.
6. Update response.
7. Nếu `resultCode !== 0` thì throw.
8. Nếu success thì trả data cho Medusa.

Admin có thể gọi refund qua API chuẩn:

```http
POST /admin/payments/:id/refund
```

## 10. VNPay Payment Flow

### 10.1. Files

Provider:

```text
apps/backend/src/modules/vnpay/index.ts
apps/backend/src/modules/vnpay/service.ts
apps/backend/src/modules/vnpay/client.ts
apps/backend/src/modules/vnpay/crypto.ts
apps/backend/src/modules/vnpay/types.ts
```

Ledger module:

```text
apps/backend/src/modules/vnpay-payment/index.ts
apps/backend/src/modules/vnpay-payment/service.ts
apps/backend/src/modules/vnpay-payment/types.ts
apps/backend/src/modules/vnpay-payment/models/vnpay-payment.ts
apps/backend/src/modules/vnpay-payment/models/vnpay-webhook-event.ts
apps/backend/src/modules/vnpay-payment/models/vnpay-refund.ts
```

Route:

```text
apps/backend/src/api/hooks/payment/vnpay/route.ts
apps/storefront/src/app/api/payment-return/vnpay/route.ts
```

Admin UI:

```text
apps/backend/src/admin/widgets/vnpay-refund-widget.tsx
apps/backend/src/api/admin/vnpay-refunds/route.ts
```

### 10.2. Khi user chọn VNPay

Storefront gọi:

```ts
initiatePaymentSession(cart, {
  provider_id: "pp_vnpay_default",
})
```

Provider `initiatePayment()`:

1. Lấy Medusa `payment_session_id`.
2. Validate VND:
   - amount integer.
   - amount >= 1000.
   - currency `vnd`.
3. Tạo `vnp_TxnRef`.
4. Tạo `vnp_CreateDate`, `vnp_ExpireDate`.
5. Build VNPay payment params.
6. Sort params và ký HMAC SHA512.
7. Tạo `payment_url`.
8. Lưu `vnpay_payment`.
9. Trả session data cho storefront.

Session data gồm:

- `vnp_txn_ref`
- `amount`
- `currency_code`
- `payment_url`
- `expires_at`

### 10.3. Khi user bấm Pay with VNPay

File:

```text
payment-button/index.tsx
```

Button lấy:

```ts
paymentSession.data.payment_url
```

và:

```ts
window.location.href = paymentUrl
```

### 10.4. VNPay return route storefront

Endpoint:

```http
GET /api/payment-return/vnpay
```

File:

```text
apps/storefront/src/app/api/payment-return/vnpay/route.ts
```

Route này:

1. Đọc `vnp_ResponseCode`.
2. Đọc `vnp_TransactionStatus`.
3. Nếu cả hai đều `00`, gọi backend hook:

```http
GET /hooks/payment/vnpay?<vnpay params>
```

4. Nếu backend trả `RspCode` là `00` hoặc `02`, gọi `placeOrder()`.
5. Nếu fail, redirect về checkout payment failed.

Điểm quan trọng:

- Storefront return route không tự mark payment success.
- Nó forward payload sang backend để backend verify checksum và mutate state.
- `RspCode=02` được coi là acceptable vì backend nói order/payment đã confirmed trước đó.

### 10.5. VNPay backend hook

Endpoint:

```http
GET /hooks/payment/vnpay
```

File:

```text
apps/backend/src/api/hooks/payment/vnpay/route.ts
```

Route này là custom route riêng, không phải generic `/hooks/payment/:provider`.

Nó làm:

1. Normalize query params.
2. Check env `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`.
3. Check required fields:
   - `vnp_TxnRef`
   - `vnp_TmnCode`
   - `vnp_SecureHash`
4. Check `vnp_TmnCode` có đúng merchant không.
5. Verify signature bằng `verifyVnpaySignature`.
6. Build `eventKey`.
7. Gọi `vnpayPaymentService.completePaymentFromGateway()`.
8. Map kết quả sang VNPay response format:
   - invalid checksum -> `RspCode=97`
   - not found -> `RspCode=01`
   - amount mismatch -> `RspCode=04`
   - duplicate -> `RspCode=02`
   - success -> `RspCode=00`
9. Nếu `process_payment = true`, gọi:

```ts
processPaymentWorkflow(req.scope).run({
  input: {
    action: "authorized",
    data: { session_id, amount },
  },
})

processPaymentWorkflow(req.scope).run({
  input: {
    action: "captured",
    data: { session_id, amount },
  },
})
```

Nghĩa là VNPay thành công thì hệ thống auto-authorize và auto-capture.

### 10.6. VNPay ledger

Bảng `vnpay_payment` lưu:

- `payment_session_id`
- `provider_id`
- `vnp_txn_ref`
- `amount`
- `currency_code`
- `status`
- `response_code`
- `transaction_status`
- `transaction_no`
- `bank_code`
- `bank_tran_no`
- `card_type`
- `pay_date`
- `payment_url`
- `raw_create_params`
- `raw_gateway_payload`
- `paid_at`
- `expires_at`
- `metadata`

Bảng `vnpay_webhook_event` lưu:

- `event_key`
- `txn_ref`
- `transaction_no`
- `response_code`
- `transaction_status`
- `signature_valid`
- `processing_status`
- `raw_payload`
- `error_message`
- `processed_at`

Bảng `vnpay_refund` lưu:

- `vnpay_payment_id`
- `payment_id`
- `request_id`
- `txn_ref`
- `amount`
- `transaction_type`
- `status`
- `response_code`
- `transaction_status`
- `message`
- `refund_transaction_no`
- `raw_request`
- `raw_response`
- `processed_at`

## 11. VNPay Refund Flow

### 11.1. Admin action

Admin UI gọi API chuẩn Medusa:

```http
POST /admin/payments/:payment_id/refund
Content-Type: application/json

{
  "amount": 100000,
  "note": "Customer requested refund"
}
```

Medusa route chuẩn sẽ gọi `refundPaymentWorkflow`, sau đó Payment Module gọi provider `refundPayment()`.

### 11.2. Custom Admin widget

File:

```text
apps/backend/src/admin/widgets/vnpay-refund-widget.tsx
```

Widget được inject vào:

```ts
zone: "order.details.side.after"
```

Nó chỉ hiển thị nếu order có payment provider bắt đầu bằng:

```text
pp_vnpay
```

Widget hiển thị:

- VNPay txn ref.
- VNPay transaction no.
- Pay date.
- Paid amount.
- Refundable amount.
- Form amount + note.
- Nút `Refund with VNPay`.
- Refund history từ bảng `vnpay_refund`.

Widget gọi:

```http
GET /admin/vnpay-refunds?payment_session_id=<payses_id>
```

để đọc audit.

Khi bấm refund, widget gọi:

```http
POST /admin/payments/:payment_id/refund
```

Nó không gọi thẳng VNPay. Đây là thiết kế đúng vì refund vẫn phải đi qua Medusa Payment Module.

### 11.3. Admin audit API

Endpoint custom:

```http
GET /admin/vnpay-refunds?payment_session_id=<payses_id>
```

File:

```text
apps/backend/src/api/admin/vnpay-refunds/route.ts
```

Route này:

1. Validate `payment_session_id`.
2. Resolve `VNPAY_PAYMENT_MODULE`.
3. Tìm `vnpay_payment`.
4. Lấy refund list bằng `listRefundsForPayment`.
5. Trả:

```json
{
  "payment": {},
  "refunds": []
}
```

Nếu thấy Admin toast `An unknown error occurred` kèm DB error kiểu `relation does not exist`, thường là chưa migrate bảng `vnpay_refund`.

Chạy:

```bash
pnpm --filter @dtc/backend exec medusa db:migrate
```

### 11.4. Provider refund logic

File:

```text
apps/backend/src/modules/vnpay/service.ts
```

Method:

```ts
refundPayment(input)
```

Các bước:

1. Convert amount.
2. Lấy `session_id` từ `input.data`.
3. Tìm `vnpay_payment` bằng payment session id.
4. Chỉ cho refund nếu status là:
   - `paid`
   - `partially_refunded`
5. Validate amount:
   - positive.
   - integer.
   - không vượt paid amount trừ total refunded.
6. Lấy `transaction_no`.
7. Lấy `transactionDate` từ:
   - `payment.pay_date`
   - `input.data.vnp_pay_date`
   - `payment.metadata.create_date`
8. Tạo `requestId` prefix `VNR`.
9. Chọn transaction type:
   - `"02"` nếu full refund lần đầu.
   - `"03"` nếu partial refund.
10. Gọi `VnpayClient.refund()`.
11. Tạo `vnpay_refund` pending.
12. Update refund response.
13. Nếu `vnp_ResponseCode !== "00"` thì throw.
14. Mark payment:
   - `refunded`
   - hoặc `partially_refunded`.
15. Trả data cho Medusa.

### 11.5. VNPay refund client

File:

```text
apps/backend/src/modules/vnpay/client.ts
```

Endpoint:

```text
https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
```

Body chính:

```json
{
  "vnp_RequestId": "...",
  "vnp_Version": "2.1.0",
  "vnp_Command": "refund",
  "vnp_TmnCode": "...",
  "vnp_TransactionType": "02",
  "vnp_TxnRef": "...",
  "vnp_Amount": 10000000,
  "vnp_OrderInfo": "...",
  "vnp_TransactionNo": "...",
  "vnp_TransactionDate": "...",
  "vnp_CreateBy": "system",
  "vnp_CreateDate": "...",
  "vnp_IpAddr": "127.0.0.1",
  "vnp_SecureHash": "..."
}
```

Lưu ý VNPay dùng amount nhân 100 trong request gateway/refund:

```ts
vnp_Amount: input.amount * 100
```

Chữ ký refund khác chữ ký payment URL.

Payment URL dùng query string sorted.

Refund dùng chuỗi nối bằng `|` theo thứ tự:

```text
requestId|version|command|tmnCode|transactionType|txnRef|amount|transactionNo|transactionDate|createBy|createDate|ipAddress|orderInfo
```

Helper nằm ở:

```text
apps/backend/src/modules/vnpay/crypto.ts
```

## 12. API Danh Sách Đã Dùng/Đã Làm

### 12.1. Storefront APIs / Server Actions

Không phải tất cả đều là HTTP route tự viết, nhưng đây là các API path mà frontend dùng qua SDK:

```http
GET /store/carts/:id
POST /store/carts
POST /store/carts/:id/line-items
POST /store/carts/:id/shipping-methods
POST /store/payment-collections/:id/payment-sessions
POST /store/carts/:id/complete
GET /store/payment-providers?region_id=<region_id>
GET /store/shipping-options?cart_id=<cart_id>
```

Server actions chính:

```text
retrieveCart()
getOrSetCart()
initiatePaymentSession()
placeOrder()
```

### 12.2. Storefront Next routes

```http
GET /api/payment-return/vnpay
GET /api/payment-return/momo
GET /api/payment-return
```

Trong đó:

- `/api/payment-return/vnpay` forward payload sang backend `/hooks/payment/vnpay`, rồi `placeOrder()` nếu backend xác nhận.
- `/api/payment-return/momo` hiện đọc `resultCode=0`, rồi `placeOrder()`.
- `/api/payment-return` là return generic cho Stripe-like flow.

### 12.3. Backend custom API routes

```http
GET /hooks/payment/vnpay
GET /admin/vnpay-refunds?payment_session_id=<payses_id>
```

`GET /hooks/payment/vnpay`:

- Verify VNPay checksum.
- Ghi `vnpay_webhook_event`.
- Update `vnpay_payment`.
- Gọi `processPaymentWorkflow` authorize + capture.

`GET /admin/vnpay-refunds`:

- Đọc audit payment/refund VNPay cho Admin widget.

### 12.4. Medusa built-in/generic APIs đang dựa vào

```http
POST /hooks/payment/bank-transfer_default
POST /hooks/payment/momo_default
POST /admin/payments/:payment_id/refund
```

Các route `/hooks/payment/:provider` là generic route của Medusa. Provider custom phải implement `getWebhookActionAndData()`.

`POST /admin/payments/:payment_id/refund` là route chuẩn Admin để tạo refund. Nó gọi Medusa refund workflow và sau đó gọi provider `refundPayment()`.

### 12.5. External gateway APIs

MoMo:

```http
POST /v2/gateway/api/create
POST /v2/gateway/api/query
POST /v2/gateway/api/refund
```

VNPay:

```http
GET https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...payment params...
POST https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
```

Bank Transfer:

- Không gọi external API thật trong provider.
- Nhận bank event qua webhook generic `/hooks/payment/bank-transfer_default`.

## 13. Database Và Migration

### 13.1. Bank Transfer tables

```text
bank_payment_reference
bank_transaction
bank_webhook_event
```

Migration:

```text
src/modules/bank-transfer-payment/migrations/Migration20260910111430.ts
```

### 13.2. MoMo tables

```text
momo_payment
momo_webhook_event
momo_refund
```

Migrations:

```text
src/modules/momo-payment/migrations/Migration20260915120000.ts
src/modules/momo-payment/migrations/Migration20260915123000.ts
```

### 13.3. VNPay tables

```text
vnpay_payment
vnpay_webhook_event
vnpay_refund
```

Migrations:

```text
src/modules/vnpay-payment/migrations/Migration20260918090000.ts
src/modules/vnpay-payment/migrations/Migration20260921120000.ts
```

Chạy migration đúng:

```bash
pnpm --filter @dtc/backend exec medusa db:migrate
```

Không dùng:

```bash
pnpm --filter @dtc/backend medusa db:migrate
```

Lệnh trên sai vì `medusa` không phải script trong `package.json`.

## 14. Environment Variables Quan Trọng

Backend:

```bash
BANK_TRANSFER_BANK_NAME=
BANK_TRANSFER_ACCOUNT_NUMBER=
BANK_TRANSFER_ACCOUNT_NAME=
BANK_TRANSFER_REFERENCE_PREFIX=PAY
BANK_TRANSFER_EXPIRY_MINUTES=30
BANK_TRANSFER_WEBHOOK_SECRET=

MOMO_ENDPOINT=https://test-payment.momo.vn
MOMO_PARTNER_CODE=
MOMO_ACCESS_KEY=
MOMO_SECRET_KEY=
MOMO_REDIRECT_URL=
MOMO_IPN_URL=
MOMO_AUTO_CAPTURE=true
MOMO_LANG=vi
MOMO_ORDER_EXPIRE_MINUTES=15

VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_TRANSACTION_API_URL=https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
VNPAY_RETURN_URL=
VNPAY_IPN_URL=
VNPAY_LOCALE=vn
VNPAY_ORDER_TYPE=other
VNPAY_PAYMENT_EXPIRY_MINUTES=15
VNPAY_REFUND_CREATE_BY=system
VNPAY_REFUND_IP_ADDRESS=127.0.0.1
```

Storefront:

```bash
MEDUSA_BACKEND_URL=
NEXT_PUBLIC_MEDUSA_BACKEND_URL=
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=
```

Security note:

- Không commit `.env` chứa secret thật.
- Nếu secret đã từng push public, rotate key.
- Với VNPay/MoMo, checksum secret là quyền mutate payment thật.

## 15. Cách Đọc Code Review Payment

Khi review một provider, đọc theo checklist này.

### 15.1. Provider registration

File:

```text
medusa-config.ts
```

Hỏi:

- Provider có được đăng ký không?
- Có dependency ledger module không?
- Provider id cuối có đúng với storefront không?
- Env nào làm provider bị ẩn?

### 15.2. Initiate payment

Method:

```ts
initiatePayment()
```

Hỏi:

- Có validate currency/amount không?
- Có tạo id/reference/order id idempotent không?
- Có lưu bảng audit không?
- Có mask signature/secret trong raw request không?
- Session data có đủ cho UI không?

### 15.3. Update payment

Method:

```ts
updatePayment()
```

Hỏi:

- Nếu cart đổi amount sau khi session tạo, provider xử lý thế nào?
- Có làm stale payment URL không?
- Có update ledger không?
- Với redirect gateway, có cần tạo giao dịch mới không?

### 15.4. Authorize/capture

Methods:

```ts
authorizePayment()
capturePayment()
getPaymentStatus()
```

Hỏi:

- Provider có tự ý trả success khi chưa có webhook không?
- `authorized` và `captured` có được phân biệt rõ không?
- Payment async trả `pending_authorization` khi chưa xác nhận không?

### 15.5. Webhook/return

Hỏi:

- Browser return có bị tin tuyệt đối không?
- Backend có verify chữ ký không?
- Có check merchant id không?
- Có check amount không?
- Có check duplicate event không?
- Có check final status để không double capture không?
- Event có được lưu raw payload không?

### 15.6. Refund

Hỏi:

- Refund có đi qua `POST /admin/payments/:id/refund` hoặc Medusa workflow không?
- Provider `refundPayment()` có validate paid transaction không?
- Có chặn refund vượt amount không?
- Có idempotency request id không?
- Có lưu raw request/response đã mask signature không?
- Gateway response pending có được phân biệt với success hoàn tất không?

### 15.7. UI

Hỏi:

- UI có chỉ hiện với đúng provider không?
- Amount hiển thị có cùng đơn vị với Medusa không?
- Button có disabled khi amount invalid không?
- Error từ API có được toast rõ không?
- Có refresh audit/history sau action không?

## 16. Những Điểm Cần Cẩn Thận

### 16.1. Đơn vị tiền

Trong Medusa project này amount đang xử lý theo major units cho VND, ví dụ:

```text
3830000 VND
```

VNPay lại yêu cầu `vnp_Amount = amount * 100`.

Vì vậy trong VNPay client có:

```ts
vnp_Amount: input.amount * 100
```

Khi đọc code, đừng nhầm đây là lỗi cents. Đây là format API của VNPay.

### 16.2. Return URL không phải nguồn sự thật

Browser redirect có thể:

- Bị user đóng tab.
- Về trước IPN.
- Bị replay.
- Bị chỉnh query nếu không verify backend.

Vì vậy:

- VNPay return route forward về backend hook để verify checksum.
- MoMo nên dựa vào IPN/reconciliation là chính.

### 16.3. Duplicate event

Các bảng event có unique key:

- Bank Transfer: duplicate transaction id.
- MoMo: `event_key`.
- VNPay: `event_key`.

Nếu không chặn duplicate, một webhook replay có thể capture/refund lặp.

### 16.4. Provider status nội bộ khác Medusa status

Ví dụ:

`vnpay_payment.status = paid` là trạng thái trong bảng custom.

Medusa payment captured là trạng thái trong Payment Module.

Hai thứ liên quan nhưng không cùng bảng. Khi debug cần xem cả hai.

### 16.5. Admin widget không phải nguồn logic

Widget chỉ là UI.

Logic thật nằm ở:

- Medusa route `/admin/payments/:id/refund`.
- Medusa refund workflow.
- Provider `refundPayment()`.
- VNPay client.
- `vnpay_refund` audit table.

Nếu widget lỗi, payment logic có thể vẫn đúng. Nếu provider lỗi, widget chỉ hiển thị lỗi.

## 17. Debug Playbook

### 17.1. Checkout không thấy provider

Kiểm tra:

1. Provider có được register trong `medusa-config.ts` không.
2. Env có đủ không.
3. Provider đã enable cho region chưa.
4. Cart đang ở region/currency đúng chưa.
5. Storefront có publishable key đúng chưa.
6. Backend đã restart chưa.

Lệnh hữu ích:

```bash
pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/enable-vnpay-provider.ts
pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/enable-momo-provider.ts
pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/enable-bank-transfer-provider.ts
```

### 17.2. VNPay Admin widget báo unknown error

Khả năng cao:

- Chưa migrate bảng `vnpay_refund`.
- Backend chưa restart sau khi thêm route.
- Order không có `payment_session_id`.

Fix:

```bash
pnpm --filter @dtc/backend exec medusa db:migrate
pnpm --filter @dtc/backend dev
```

### 17.3. VNPay thanh toán xong nhưng không tạo order

Kiểm tra:

1. Storefront `/api/payment-return/vnpay` có nhận query không.
2. Backend `/hooks/payment/vnpay` có trả `RspCode=00` hoặc `02` không.
3. `vnpay_payment` có status `paid` không.
4. `vnpay_webhook_event` có `signature_valid=true` không.
5. Medusa payment có captured không.
6. `placeOrder()` có fail vì cart/session stale không.

### 17.4. MoMo thanh toán xong nhưng order fail

Kiểm tra:

1. IPN có gọi `/hooks/payment/momo_default` không.
2. `momo_webhook_event.signature_valid` có true không.
3. `momo_payment.status` là `paid` hay vẫn `pending`.
4. Reconciliation job có chạy không.
5. Return route có chạy trước IPN không.

### 17.5. Bank Transfer webhook không authorize

Kiểm tra:

1. Payload có `transaction_id` không.
2. Amount/currency đúng không.
3. Reference parse được không.
4. Reference còn `pending` không.
5. `bank_transaction.status` là gì.
6. `bank_webhook_event.status` là gì.

## 18. SQL Debug Gợi Ý

VNPay:

```sql
select
  id,
  payment_session_id,
  vnp_txn_ref,
  amount,
  status,
  response_code,
  transaction_status,
  transaction_no,
  pay_date,
  paid_at,
  created_at
from vnpay_payment
order by created_at desc
limit 20;
```

```sql
select
  event_key,
  txn_ref,
  transaction_no,
  response_code,
  transaction_status,
  signature_valid,
  processing_status,
  error_message,
  processed_at,
  created_at
from vnpay_webhook_event
order by created_at desc
limit 20;
```

```sql
select
  request_id,
  txn_ref,
  amount,
  transaction_type,
  status,
  response_code,
  transaction_status,
  refund_transaction_no,
  processed_at,
  created_at
from vnpay_refund
order by created_at desc
limit 20;
```

MoMo:

```sql
select
  payment_session_id,
  momo_order_id,
  request_id,
  amount,
  status,
  result_code,
  trans_id,
  paid_at,
  created_at
from momo_payment
order by created_at desc
limit 20;
```

Bank Transfer:

```sql
select
  payment_reference,
  payment_session_id,
  expected_amount,
  currency_code,
  status,
  matched_transaction_id,
  received_amount,
  matched_at,
  expires_at
from bank_payment_reference
order by created_at desc
limit 20;
```

Medusa payment:

```sql
select
  id,
  payment_session_id,
  amount,
  currency_code,
  provider_id,
  captured_at,
  canceled_at,
  data,
  created_at
from payment
order by created_at desc
limit 20;
```

## 19. Test Checklist Tổng

### Bank Transfer

- Chọn Bank Transfer ở checkout.
- Reference hiển thị đúng.
- Place order được khi payment pending authorization.
- Webhook exact amount -> `matched`.
- Duplicate transaction id -> duplicate/ignored.
- Underpaid -> không authorize.
- Overpaid -> không authorize.
- Expired reference -> không authorize.

### MoMo

- Chọn MoMo tạo session có `pay_url`.
- Final button redirect sang MoMo.
- IPN signature valid -> `momo_payment.status=paid`.
- Medusa payment captured hoặc authorized theo action.
- Duplicate IPN không double process.
- Reconciliation job xử lý candidate pending.
- Refund tạo `momo_refund`.

### VNPay

- Chọn VNPay tạo `payment_url`.
- Final button redirect sang VNPay.
- Return route forward backend hook.
- Backend verify checksum.
- Success update `vnpay_payment.status=paid`.
- Success gọi processPaymentWorkflow authorized + captured.
- Duplicate return/hook trả `RspCode=02`.
- Amount mismatch trả `RspCode=04`.
- Admin widget hiện trên order VNPay.
- Refund full tạo `transaction_type=02`.
- Refund partial tạo `transaction_type=03`.
- Refund vượt amount bị chặn.
- `vnpay_refund` lưu raw request/response đã mask checksum.

## 20. Những Việc Nên Cải Thiện Tiếp

1. Chuyển VNPay custom hook mutation vào workflow step để hết warning:

```text
@medusajs/no-service-mutations-in-api-route
```

2. Thêm reconciliation job cho VNPay:

- Query transaction/refund pending.
- Update `vnpay_payment` và `vnpay_refund`.
- Không refund lại khi gateway đang processing.

3. Làm MoMo return route chặt hơn:

- Không chỉ dựa vào `resultCode`.
- Query backend trusted status trước khi `placeOrder()`.

4. Thêm Admin widget cho MoMo/Bank Transfer audit nếu cần.

5. Thêm unit tests cho:

- VNPay refund signature string.
- VNPay amount conversion.
- duplicate event.
- refund over amount.

6. Thêm integration test cho:

- checkout -> session -> webhook -> order complete.
- admin refund -> provider refund -> audit table.

## 21. Tóm Tắt Một Câu

Payment system trong repo này đang đi theo hướng đúng: Storefront chỉ điều hướng và hiển thị, Medusa Payment Module giữ lifecycle chuẩn, provider custom nói chuyện với gateway, còn ledger module riêng lưu mọi thứ để idempotency, reconciliation và audit. Khi review hoặc debug, luôn đi theo chuỗi: `storefront session -> provider initiate -> custom ledger -> gateway event -> webhook verification -> Medusa workflow -> payment/order/refund record`.
