# Project Review - Medusa Core Lab

## 1. Tong quan

Repo `my-medusa-store` la monorepo MedusaJS v2 gom 2 app chinh:

- `apps/backend`: Medusa backend, custom payment providers, ledger modules, jobs, seed scripts.
- `apps/storefront`: Next.js storefront, checkout UI, cart/order/payment data actions.

Project hien dang tap trung vao payment flow cho thi truong VND, gom:

- Bank Transfer provider.
- MoMo wallet provider theo `captureWallet`.
- MoMo QR sandbox/dev API moi them de test bang Postman truoc khi gan vao UI checkout.

Backend dang di theo dung huong Medusa v2:

- Payment provider nam trong `src/modules/<provider>`.
- Du lieu nghiep vu rieng nam trong module ledger rieng, vi du `momo-payment`.
- Webhook thanh toan that duoc xu ly qua server-side IPN, khong tin redirect frontend de confirm payment.

## 2. Cau truc thu muc chinh

### Root

- `package.json`: monorepo scripts.
- `pnpm-workspace.yaml`: workspace config.
- `turbo.json`: task pipeline.
- Cac file tai lieu nhu `MOMO_PAYMENT_DEMO_SCRIPT.md`, `MOMO_CAPTURE_WALLET_FLOW_PLAN.md`, `BANK_TRANSFER_IMPLEMENTATION_GUIDE.md`.

### `apps/backend`

- `medusa-config.ts`
  - Load env.
  - Dang ky custom modules.
  - Dang ky payment providers vao `@medusajs/medusa/payment`.
  - Cau hinh Bank Transfer va MoMo provider.

- `src/api`
  - Custom HTTP routes.
  - Hien co route mau:
    - `src/api/admin/custom/route.ts`
    - `src/api/store/custom/route.ts`
  - MoMo QR dev routes moi:
    - `src/api/store/momo-qr/create/route.ts`
    - `src/api/store/momo-qr/status/[orderId]/route.ts`
    - `src/api/hooks/momo/ipn/route.ts`

- `src/modules`
  - Noi dat custom Medusa modules/providers.
  - `bank-transfer`: payment provider Bank Transfer.
  - `bank-transfer-payment`: ledger/data module cho Bank Transfer.
  - `momo`: MoMo payment provider.
  - `momo-payment`: ledger/data module cho MoMo.

- `src/jobs`
  - Scheduled jobs.
  - `expire-bank-transfer-payments.ts`: xu ly expire bank transfer.
  - `reconcile-momo-payments.ts`: query lai MoMo neu IPN bi mat/tre.

- `src/migration-scripts`
  - Seed data.
  - Script enable provider vao region:
    - `enable-bank-transfer-provider.ts`
    - `enable-momo-provider.ts`

- `src/lib`
  - Helper dung chung.
  - `momo-dev.ts`: helper cho API test MoMo QR sandbox/dev.

### `apps/storefront`

- `src/app`
  - Next.js App Router pages.
  - Checkout nam tai `src/app/[countryCode]/(checkout)/checkout/page.tsx`.
  - MoMo return route:
    - `src/app/api/payment-return/momo/route.ts`

- `src/lib/data`
  - Server actions/data access.
  - `cart.ts` quan trong nhat cho checkout:
    - `retrieveCart`
    - `initiatePaymentSession`
    - `placeOrder`

- `src/modules/checkout`
  - UI checkout.
  - `components/payment/index.tsx`: chon payment method, initiate session.
  - `components/payment-button/index.tsx`: nut final payment, bao gom `MomoPaymentButton`.

- `src/lib/constants.tsx`
  - Mapping provider id sang ten/icon.
  - Helper detect provider:
    - `isBankTransfer`
    - `isMomo`
    - `isStripeLike`
  - `vnd` nam trong `noDivisionCurrencies`, dung de hien thi tien VND khong chia 100.

## 3. Backend payment architecture

Project tach payment thanh 2 lop:

1. Payment provider module
   - Noi Medusa Payment Module goi vao.
   - Chiu trach nhiem initiate, authorize, capture, refund, webhook action.
   - Vi du: `src/modules/momo/service.ts`.

2. Ledger/data module
   - Luu transaction, webhook event, refund.
   - Chiu trach nhiem idempotency va doi soat.
   - Vi du: `src/modules/momo-payment/service.ts`.

Cach tach nay tot vi:

- Provider khong phai giu state trong memory.
- IPN co the retry ma khong double-process.
- Reconciliation co the update lai payment neu webhook bi mat.
- Co log raw request/response de debug sandbox/production.

## 4. MoMo module hien tai

### `src/modules/momo`

Day la payment provider that cho Medusa.

- `index.ts`
  - Dang ky `MomoPaymentProviderService` la provider cua Payment Module.

- `service.ts`
  - Core provider.
  - `static identifier = "momo"`.
  - Provider id khi vao Medusa se la `pp_momo_default`.
  - Cac method quan trong:
    - `initiatePayment`: tao MoMo payment request.
    - `authorizePayment`: check ledger de tra ve `authorized` hoac `pending_authorization`.
    - `capturePayment`: mark capture data.
    - `refundPayment`: goi MoMo refund API.
    - `getPaymentStatus`: doc ledger de tra status cho Medusa.
    - `getWebhookActionAndData`: Medusa standard payment webhook entrypoint.
    - `processIpn`: verify IPN signature va update ledger.

- `client.ts`
  - Goi MoMo API:
    - `/v2/gateway/api/create`
    - `/v2/gateway/api/query`
    - `/v2/gateway/api/refund`
  - Co mock mode neu chua co credential that.
  - `createPayment` tra ve cac field quan trong:
    - `payUrl`
    - `shortLink`
    - `deeplink`
    - `qrCodeUrl`
    - `deeplinkMiniApp`

- `crypto.ts`
  - Build raw signature data dung thu tu field cua MoMo.
  - Sign HMAC SHA256.
  - Verify signature bang timing-safe compare.
  - Tao random MoMo id.

- `types.ts`
  - Type cho provider options, create payment request/response, IPN payload, query, refund.

### `src/modules/momo-payment`

Day la ledger module cho MoMo.

- `models/momo-payment.ts`
  - Luu 1 payment transaction.
  - Cac field quan trong:
    - `payment_session_id`
    - `momo_order_id`
    - `request_id`
    - `amount`
    - `currency_code`
    - `status`
    - `pay_url`
    - `deeplink`
    - `qr_code_url`
    - `trans_id`
    - `raw_create_request`
    - `raw_create_response`

- `models/momo-webhook-event.ts`
  - Luu moi lan MoMo goi IPN.
  - Dung `event_key` de idempotency.

- `models/momo-refund.ts`
  - Luu refund transaction.

- `service.ts`
  - `upsertPaymentFromSession`: tao/update MoMo payment khi initiate.
  - `retrievePaymentBySessionId`: tim theo Medusa payment session.
  - `retrievePaymentByMomoOrderId`: tim theo MoMo order id.
  - `completePaymentFromIpn`: verify business rules va update status.
  - `listReconciliationCandidates`: lay cac payment pending de query lai MoMo.

## 5. MoMo checkout flow hien tai

### Flow tong quan

```text
Customer chon MoMo o checkout
-> Storefront goi initiatePaymentSession
-> Backend MomoPaymentProviderService.initiatePayment
-> MomoClient.createPayment goi MoMo create API
-> Luu momo_payment vao DB
-> Storefront refresh cart, doc payment_session.data
-> Customer sang step Review
-> Bam Pay with MoMo
-> Redirect sang payUrl/deeplink
-> MoMo xu ly thanh toan
-> MoMo goi IPN ve backend
-> Backend verify signature va update ledger
-> Medusa Payment Module authorize/capture theo webhook action
```

### Buoc 1: Frontend chon MoMo

File: `apps/storefront/src/modules/checkout/components/payment/index.tsx`

Khi user chon provider co id bat dau bang `pp_momo`, UI goi:

```ts
initiatePaymentSession(cart, {
  provider_id: method,
})
```

Sau do `router.refresh()` de lay lai cart moi co `payment_collection.payment_sessions`.

### Buoc 2: Backend initiate payment

File: `apps/backend/src/modules/momo/service.ts`

`initiatePayment` lam cac viec:

- Lay `payment_session_id` tu input data.
- Convert amount ve number.
- Check currency phai la `vnd`.
- Tao:
  - `momoOrderId`
  - `requestId`
  - `orderInfo`
  - `extraData`
- Goi `MomoClient.createPayment`.
- Luu ket qua vao `momo_payment`.
- Tra ve `data` cho payment session, gom:
  - `pay_url`
  - `short_link`
  - `deeplink`
  - `qr_code_url`
  - `deeplink_mini_app`
  - `amount`
  - `expires_at`

### Buoc 3: Frontend hien thi MoMo details

File: `apps/storefront/src/modules/checkout/components/payment/index.tsx`

Component `MomoDetails` hien tai chi hien:

- Amount
- Expires
- Method = MoMo wallet

No chua render QR trong checkout UI. QR sandbox hien dang co API rieng de test bang Postman.

### Buoc 4: Customer bam Pay with MoMo

File: `apps/storefront/src/modules/checkout/components/payment-button/index.tsx`

`MomoPaymentButton` lay:

- `pay_url` hoac `short_link` cho desktop.
- `deeplink` cho mobile.

Sau do redirect:

```text
window.location.href = paymentUrl
```

Route nay co append:

- `cart_id`
- `country_code`

de storefront return route biet cart nao dang quay ve.

### Buoc 5: MoMo return frontend

File: `apps/storefront/src/app/api/payment-return/momo/route.ts`

Route nay chi dung cho UX redirect:

- Neu mock success thi co goi `placeOrder`.
- Neu real MoMo thi redirect ve:
  - `checkout?step=review&momo_return=success`
  - hoac `checkout?step=payment&momo_return=failed`

Luu y quan trong: real payment success khong nen dua vao route nay. Payment truth nam o IPN server-side.

### Buoc 6: MoMo IPN

Flow chuan nen dung:

```text
POST /hooks/payment/momo_default
```

Day la Medusa standard payment webhook route. No se goi:

```ts
MomoPaymentProviderService.getWebhookActionAndData()
```

Sau do provider goi:

```ts
processIpn()
```

`processIpn`:

- Check required fields.
- Check `partnerCode`.
- Build raw signature data.
- Sign lai bang `secretKey`.
- Timing-safe compare voi `body.signature`.
- Tao `event_key`.
- Goi `momoPaymentService.completePaymentFromIpn`.

`completePaymentFromIpn`:

- Check duplicate event.
- Tim payment bang `momo_order_id`.
- Check signature.
- Check request id.
- Check amount.
- Neu `result_code === 0`: mark `paid`.
- Neu `result_code === 9000`: mark `authorized`.
- Neu pending code: giu `pending`.
- Con lai: mark `failed`.

Neu payment co the process, provider tra action cho Medusa:

- `authorized`
- hoac `captured`

## 6. MoMo QR sandbox/dev API moi

Da them cac route rieng de test QR flow bang Postman truoc khi gan vao checkout UI.

### Tao QR payment

```text
POST /store/momo-qr/create
```

Body mau:

```json
{
  "amount": 10000,
  "orderInfo": "Thanh toan don hang test QR MoMo",
  "cartId": "cart_test_001"
}
```

Route nay:

- Doc env MoMo qua `src/lib/momo-dev.ts`.
- Goi `MomoClient.createPayment`.
- Luu transaction vao `momo_payment`.
- Tra ve:
  - `momoOrderId`
  - `requestId`
  - `qrCodeUrl`
  - `payUrl`
  - `deeplink`
  - `status`

Luu y: `qrCodeUrl` la data/string de generate QR, khong phai anh QR.

### Poll status

```text
GET /store/momo-qr/status/:orderId
```

Route nay doc `momo_payment` theo `momo_order_id` va tra ve status hien tai.

### IPN dev

```text
POST /hooks/momo/ipn
```

Route nay dung `MomoPaymentProviderService.processIpn` de verify signature va update ledger. Phu hop de test sandbox/doc Postman nhanh.

Voi flow Medusa checkout that, nen uu tien IPN chuan:

```text
/hooks/payment/momo_default
```

## 7. Reconciliation flow cho MoMo

File: `apps/backend/src/jobs/reconcile-momo-payments.ts`

Job chay moi 5 phut:

```text
schedule: "*/5 * * * *"
```

Flow:

```text
Lay momo_payment status pending/authorized
-> Goi MoMo query API
-> Neu resultCode = 0 va co transId
-> completePaymentFromIpn voi signature_valid=true
-> Goi processPaymentWorkflow authorized
-> Goi processPaymentWorkflow captured
```

Job nay la fallback tot neu:

- MoMo IPN bi delay.
- Backend bi restart luc IPN goi den.
- Network loi tam thoi.

## 8. Env quan trong cho MoMo

Sandbox/real config can:

```env
MOMO_PARTNER_CODE=...
MOMO_ACCESS_KEY=...
MOMO_SECRET_KEY=...
MOMO_ENDPOINT=https://test-payment.momo.vn
MOMO_REDIRECT_URL=http://localhost:8000/api/payment-return/momo
MOMO_IPN_URL=https://<public-backend-url>/hooks/payment/momo_default
MOMO_MOCK_ENABLED=false
MOMO_AUTO_CAPTURE=true
MOMO_LANG=vi
MOMO_ORDER_EXPIRE_MINUTES=15
```

Neu test route dev IPN rieng:

```env
MOMO_IPN_URL=https://<public-backend-url>/hooks/momo/ipn
```

Khi chay local can dung public HTTPS tunnel nhu ngrok vi MoMo khong goi duoc `localhost`.

## 9. Danh gia hien trang

### Diem tot

- MoMo provider da tach ro client, crypto, service, types.
- Ledger module co bang payment, webhook event, refund.
- IPN co verify signature va idempotency.
- Co mock mode cho dev khi chua co credential.
- Co reconciliation job de query lai MoMo.
- Storefront khong confirm payment real bang redirect.
- VND da duoc khai bao la currency khong chia 100.

### Diem can luu y

- Checkout UI hien tai chua render QR MoMo; user dang duoc redirect qua `payUrl/deeplink`.
- `qr_code_url` da co trong session data nhung chua duoc dung trong component `MomoDetails`.
- Route `/hooks/momo/ipn` moi la dev/test route. Production nen dung `/hooks/payment/momo_default` de Medusa Payment Module xu ly action day du.
- `payment-return/momo` co xu ly mock success bang `placeOrder`, nhung real flow van phai doi IPN.
- Can dam bao region VND da enable `pp_momo_default` bang migration script.

## 10. De xuat next step

1. Test API QR sandbox bang Postman:
   - `POST /store/momo-qr/create`
   - scan `qrCodeUrl`
   - poll `GET /store/momo-qr/status/:orderId`

2. Sau khi sandbox QR on dinh, gan QR vao checkout UI:
   - Lay `activeSession.data.qr_code_url`.
   - Render QR trong `MomoDetails`.
   - Giu `pay_url/deeplink` lam fallback.

3. Chuan hoa IPN:
   - Dev co the dung `/hooks/momo/ipn`.
   - Checkout production nen dung `/hooks/payment/momo_default`.

4. Them integration test cho:
   - Create payment thanh cong.
   - IPN success.
   - IPN duplicate.
   - Sai signature.
   - Sai amount.

5. Them admin/debug view hoac script query DB de xem:
   - `momo_payment`
   - `momo_webhook_event`
   - `momo_refund`
