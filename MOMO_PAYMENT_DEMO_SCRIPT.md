# MoMo Payment Demo Script

Updated: 2026-09-15

## 1. Demo Message

Short version:

> Đây là demo MoMo Payment cho Medusa. Khách chọn MoMo ở checkout, backend tạo một payment session và một MoMo one-time payment request theo flow `captureWallet`. Khách bấm Pay with MoMo để đi sang MoMo. Kết quả thanh toán thật phải được xác nhận qua server-side IPN tại route chuẩn của Medusa: `/hooks/payment/momo_default`.

Important point:

> Browser redirect không phải source of truth. Redirect chỉ đưa khách quay lại storefront. Payment state phải dựa trên IPN hoặc reconciliation query từ backend.

## 2. Demo Modes

### Mock Mode

Dùng khi dev cá nhân không có MoMo merchant credentials.

```bash
MOMO_MOCK_ENABLED=true
MOMO_REDIRECT_URL=http://localhost:8000/api/payment-return/momo
MOMO_IPN_URL=http://localhost:9001/hooks/payment/momo_default
MOMO_AUTO_CAPTURE=true
MOMO_LANG=vi
MOMO_ORDER_EXPIRE_MINUTES=15
```

Mock mode chứng minh được:

- `pp_momo_default` được register và enable trong region.
- Storefront hiển thị MoMo trong checkout.
- Backend tạo `momo_payment` ledger.
- MoMo session có fake `payUrl`, `deeplink`, `qrCodeUrl`.
- Khách đi qua flow redirect UX.

Mock mode không chứng minh được:

- MoMo app sandbox thật.
- IPN thật từ MoMo.
- Refund thật.

### Real Sandbox Mode

Dùng khi có MoMo sandbox credentials:

```bash
MOMO_MOCK_ENABLED=false
MOMO_ENDPOINT=https://test-payment.momo.vn
MOMO_PARTNER_CODE=<sandbox-partner-code>
MOMO_ACCESS_KEY=<sandbox-access-key>
MOMO_SECRET_KEY=<sandbox-secret-key>
MOMO_REDIRECT_URL=https://<public-storefront-url>/api/payment-return/momo
MOMO_IPN_URL=https://<public-backend-url>/hooks/payment/momo_default
MOMO_AUTO_CAPTURE=true
MOMO_LANG=vi
MOMO_ORDER_EXPIRE_MINUTES=15
```

## 3. Prepare Demo

Start infra:

```bash
docker compose up -d
```

Run migrations:

```bash
cd my-medusa-store
pnpm --filter @dtc/backend exec medusa db:migrate
```

Enable MoMo provider for VND region:

```bash
pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/enable-momo-provider.ts
```

Expected log:

```text
[momo] Enabled pp_momo_default for 1 VND region(s).
```

Start backend:

```bash
PORT=9001 MEDUSA_ADMIN_DISABLED=true pnpm --filter @dtc/backend dev
```

Start storefront:

```bash
pnpm --filter @dtc/storefront dev
```

Open:

```text
http://localhost:8000/vn
```

## 4. Verify Provider Is Visible

Get region id from storefront/cart, or query regions:

```bash
curl "http://localhost:9001/store/regions"
```

Then check payment providers:

```bash
curl "http://localhost:9001/store/payment-providers?region_id=<REGION_ID>"
```

Expected response contains:

```json
{
  "id": "pp_momo_default"
}
```

If it does not appear:

- Restart backend after changing `.env`.
- Run `enable-momo-provider.ts` again.
- Make sure checkout cart is in VND region.
- Restart storefront or hard refresh checkout.

## 5. Demo Flow A - Customer Selects MoMo

Actions:

1. Open storefront.
2. Add a product to cart.
3. Go to checkout.
4. Fill email, shipping address, billing address.
5. Select shipping method.
6. Go to Payment step.
7. Select `MoMo`.

Expected UI:

```text
Payment
● MoMo
  Amount: ...
  Method: MoMo wallet
  Expires: ...

[Continue to review]
```

Talking point:

> Khi chọn MoMo, frontend gọi Store API để initiate payment session. Backend provider tạo `momo_order_id`, `request_id`, ký request MoMo, rồi nhận về `payUrl`. Trong mock mode, phần gọi MoMo thật được thay bằng fake response local.

Expected DB:

```text
momo_payment.status = pending
momo_payment.payment_session_id = payses_...
momo_payment.momo_order_id = MM...
momo_payment.request_id = MR...
momo_payment.pay_url is not null
```

## 6. Demo Flow B - Review and Pay

Actions:

1. Click `Continue to review`.
2. Confirm order summary.
3. Click `Pay with MoMo`.

Expected behavior:

- Desktop opens `payUrl`.
- Mobile opens `deeplink` if available.
- Mock mode redirects to local return route.

Talking point:

> Đây là payment execution step. Selecting MoMo chỉ chuẩn bị session; clicking Pay with MoMo mới đưa khách sang MoMo/hosted payment.

## 7. Demo Flow C - Return From MoMo

Current implementation:

```text
MoMo redirect
→ /api/payment-return/momo
→ checkout?step=review&momo_return=success
```

Important caveat:

> Return route hiện tại chưa complete cart thành order. Nó chỉ đưa khách về checkout/review. Để production-ready, route này cần query trusted backend payment state và chỉ gọi `placeOrder(cartId)` khi Medusa payment đã captured/authorized hợp lệ.

Expected current behavior:

- In mock mode, browser returns to checkout review.
- You may still need to complete order flow after implementing trusted-state return handling.

## 8. Demo Flow D - Standard MoMo Webhook

Webhook endpoint:

```text
POST /hooks/payment/momo_default
```

This is the only backend webhook route for MoMo.

Flow:

```text
MoMo IPN
→ Medusa standard payment webhook route
→ MomoPaymentProviderService.getWebhookActionAndData()
→ verify HMAC signature
→ verify partnerCode/orderId/requestId/amount
→ record momo_webhook_event
→ update momo_payment
→ return Medusa payment action
```

Successful auto-captured MoMo payment:

```text
resultCode = 0
ledger = paid
Medusa action = captured
```

Authorized-only payment:

```text
resultCode = 9000
ledger = authorized
Medusa action = authorized
```

Failure:

```text
resultCode != 0 and not pending
ledger = failed
Medusa action = failed
```

## 9. Manual Webhook Test

For real signed testing, build the signature using:

```text
my-medusa-store/apps/backend/src/modules/momo/crypto.ts
```

IPN signature raw string:

```text
accessKey=$accessKey&amount=$amount&extraData=$extraData&message=$message&orderId=$orderId&orderInfo=$orderInfo&orderType=$orderType&partnerCode=$partnerCode&payType=$payType&requestId=$requestId&responseTime=$responseTime&resultCode=$resultCode&transId=$transId
```

Example payload shape:

```json
{
  "partnerCode": "MOMO_MOCK_PARTNER",
  "orderId": "MM...",
  "requestId": "MR...",
  "amount": 350000,
  "orderInfo": "Medusa cart payment payses_...",
  "orderType": "momo_wallet",
  "transId": 123456789,
  "resultCode": 0,
  "message": "Successful.",
  "payType": "webApp",
  "responseTime": 1710000000000,
  "extraData": "",
  "paymentOption": "momo",
  "signature": "<hmac-sha256>"
}
```

Post to:

```bash
curl -X POST "http://localhost:9001/hooks/payment/momo_default" \
  -H "Content-Type: application/json" \
  -d '<SIGNED_PAYLOAD>'
```

Expected:

```text
momo_webhook_event.processing_status = processed
momo_payment.status = paid
momo_payment.trans_id = <transId>
```

## 10. Reconciliation Demo

Job:

```text
reconcile-momo-payments
```

Schedule:

```text
*/5 * * * *
```

Talking point:

> Nếu IPN bị mất hoặc backend crash giữa đường, reconciliation query sẽ hỏi lại MoMo transaction status. Trong mock mode, query trả success fake để chứng minh repair path.

Expected:

```text
pending momo_payment
→ query MoMo/mock
→ paid if gateway reports success
→ Medusa payment workflow repaired
```

## 11. SQL Checks

Check latest MoMo payments:

```sql
select
  id,
  payment_session_id,
  momo_order_id,
  request_id,
  amount,
  currency_code,
  status,
  result_code,
  trans_id,
  pay_type,
  payment_option,
  order_type,
  created_at,
  updated_at
from momo_payment
order by created_at desc
limit 10;
```

Check webhook events:

```sql
select
  id,
  event_key,
  order_id,
  request_id,
  trans_id,
  result_code,
  signature_valid,
  processing_status,
  error_message,
  created_at,
  processed_at
from momo_webhook_event
order by created_at desc
limit 10;
```

Check refunds:

```sql
select
  id,
  momo_payment_id,
  refund_order_id,
  request_id,
  amount,
  status,
  result_code,
  refund_trans_id,
  created_at,
  processed_at
from momo_refund
order by created_at desc
limit 10;
```

## 12. Known Gap Before Production

Current return route is still demo-level:

```text
/api/payment-return/momo
```

It must be upgraded before production:

```text
return route
→ restore cart id
→ query trusted Medusa/backend payment state
→ if paid/captured, complete cart
→ redirect to order confirmed
→ if pending, show confirming/polling state
→ if failed, return to payment step
```

## 13. Demo Summary

What this demo proves:

- MoMo provider can be registered in Medusa.
- Storefront can select MoMo.
- Provider creates a `captureWallet` payment session.
- Ledger stores MoMo order/request/payment state.
- Standard Medusa webhook path is the integration point.
- Mock mode lets personal developers demo without merchant credentials.

What still needs real sandbox credentials:

- Real MoMo app payment.
- Real IPN from MoMo.
- Real refund behavior.
