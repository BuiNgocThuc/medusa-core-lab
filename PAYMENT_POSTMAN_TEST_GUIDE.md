# Payment Postman Test Guide

Updated: 2026-10-01

Collection chinh: `vnpay_postman_collection.json`

Fallback neu Postman import collection bi rong:

1. `payment_postman_collection_flat.json`
2. `payment_postman_collection_compatible.json`
3. `postman_import_smoke_test.json` de kiem tra importer co doc duoc Postman collection hay khong.

## 1. Muc Tieu

File Postman nay dung de test tay cac nhom API payment trong project:

- Medusa Store/Admin payment flow.
- VNPay custom IPN hook va audit refund.
- MoMo standard webhook cua Medusa va audit refund.
- Bank Transfer webhook.
- VNPay sandbox gateway: PAY redirect, get bank list, QueryDR, Refund.
- MoMo sandbox gateway: create payment, query, refund, refund query, confirm/cancel.
- Mot so template MoMo mo rong chua gan backend: tokenization, subscription, disbursement.

Nguon doc tham khao:

- VNPay PAY / payment URL / get bank list: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
- VNPay QueryDR / Refund: https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr&refund.html
- MoMo create payWithMethod: https://developers.momo.vn/v3/vi/docs/payment/api/collection-link/
- MoMo query payment: https://developers.momo.vn/v3/docs/payment/api/payment-api/query/
- MoMo refund / refund query: https://developers.momo.vn/v3/docs/payment/api/payment-api/refund/
- MoMo confirm capture/cancel: https://developers.momo.vn/v3/docs/payment/api/payment-api/confirm/

## 2. Chuan Bi

Backend nen chay public/local:

```bash
cd my-medusa-store
pnpm --filter @dtc/backend dev
```

Neu dung port khac, sua Collection Variable `backend_url`.

Can co cac env trong `my-medusa-store/apps/backend/.env` neu test gateway that:

```env
VNPAY_TMN_CODE=...
VNPAY_HASH_SECRET=...
VNPAY_RETURN_URL=...
VNPAY_IPN_URL=...

MOMO_ENDPOINT=https://test-payment.momo.vn
MOMO_PARTNER_CODE=...
MOMO_ACCESS_KEY=...
MOMO_SECRET_KEY=...
MOMO_REDIRECT_URL=...
MOMO_IPN_URL=...
```

Sau khi sua env, restart backend va enable provider neu can:

```bash
pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/enable-vnpay-provider.ts
pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/enable-momo-provider.ts
pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/enable-bank-transfer-provider.ts
```

## 3. Collection Variables Can Dien

Bat buoc cho Store API:

- `backend_url`: vi du `http://localhost:9001`
- `publishable_key`: publishable API key cua store.
- `region_id`: VND region id. Co the tu lay bang request `Store - List Regions`.
- `cart_id`: cart dang checkout.
- `payment_collection_id`: lay tu cart hoac request create payment collection.

Bat buoc cho Admin API:

- `admin_email`
- `admin_password`
- `admin_token`: co the lay bang request `Admin Auth - Login email/password`.

Bat buoc cho VNPay:

- `vnpay_tmn_code`
- `vnpay_hash_secret`
- `vnpay_payment_url`
- `vnpay_transaction_api`
- `vnpay_bank_list_api`

Bat buoc cho MoMo:

- `momo_endpoint`
- `momo_partner_code`
- `momo_access_key`
- `momo_secret_key`
- `momo_redirect_url`
- `momo_ipn_url`

So tien:

- `amount_vnd`: so tien thanh toan theo VND, vi du `100000`.
- `refund_amount_vnd`: so tien refund theo VND, vi du `50000`.

## 4. Thu Tu Test Medusa Payment Noi Bo

### 4.1. Kiem tra provider trong region

Chay:

1. `Store - List Regions`
2. `Store - List Payment Providers by Region`

Ket qua mong doi co cac provider:

- `pp_vnpay_default`
- `pp_momo_default`
- `pp_bank-transfer_default`
- `pp_system_default`

Neu khong thay VNPay/MoMo:

- Kiem tra env day du.
- Restart backend.
- Chay lai migration script enable provider.
- Kiem tra region co currency `vnd`.

### 4.2. Tao payment collection

Chay:

1. `Store - Retrieve Cart With Payment Collection`
2. Neu cart chua co `payment_collection`, chay `Store - Create Payment Collection For Cart`.

Request nay tu set:

- `cart_id`
- `region_id`
- `payment_collection_id`
- `payment_session_id` neu da co session.

### 4.3. Khoi tao payment session

Chay mot trong cac request:

- `Store - Initialize Payment Session (VNPay)`
- `Store - Initialize Payment Session (MoMo)`
- `Store - Initialize Payment Session (Bank Transfer)`

Ket qua mong doi:

- VNPay: response co `payment_url`.
- MoMo: response co `pay_url`, co the co `deeplink`, `short_link`, `qr_code_url`.
- Bank Transfer: response co `payment_reference`, thong tin ngan hang va huong dan chuyen khoan.

Collection se co gang tu set:

- `payment_session_id`
- `vnpay_generated_payment_url`
- `momo_generated_pay_url`
- `momo_order_id`
- `momo_request_id`
- `bank_payment_reference`

## 5. Test Backend Hook Va Audit

### 5.1. VNPay custom IPN hook

Request:

- `VNPay - Custom IPN Hook Success`

Can co:

- `vnpay_txn_ref`: phai trung voi `vnp_txn_ref` da tao trong bang `vnpay_payment`.
- `amount_vnd`: phai bang amount cua payment session.
- `vnpay_hash_secret`: dung voi backend.

Request dung pre-request script de ky `vnp_SecureHash` bang HMAC-SHA512 theo dung cach backend dang verify.

Ket qua mong doi:

```json
{
  "RspCode": "00",
  "Message": "Confirm Success"
}
```

Neu amount sai, backend tra:

```json
{
  "RspCode": "04",
  "Message": "Invalid amount"
}
```

Neu checksum sai:

```json
{
  "RspCode": "97",
  "Message": "Invalid checksum"
}
```

### 5.2. MoMo standard webhook/IPN

Request:

- `MoMo - Standard Payment Webhook/IPN Success`

Can co:

- `momo_order_id`: phai trung voi record `momo_payment`.
- `momo_request_id`: phai trung voi record `momo_payment`.
- `amount_vnd`: phai bang amount.
- `momo_trans_id`: transId thanh cong.

Request ky `signature` bang HMAC-SHA256 theo format trong provider `src/modules/momo/service.ts`.

Ket qua mong doi:

- Ledger `momo_payment` chuyen sang `paid`.
- Medusa payment workflow duoc authorize/capture theo action provider tra ve.

### 5.3. Bank Transfer webhook

Request:

- `Bank Transfer - Standard Webhook Completed`

Can co:

- `bank_payment_reference`: noi dung chuyen khoan da sinh tu Bank Transfer session.
- `amount_vnd`: dung bang expected amount.
- `bank_webhook_secret`: chi can dien neu backend co `BANK_TRANSFER_WEBHOOK_SECRET`.

Ket qua mong doi:

- `bank_payment_reference.status = matched`.
- Payment session duoc authorize.

### 5.4. Refund audit

Requests:

- `Admin - Audit VNPay Refunds`
- `Admin - Audit MoMo Refunds`

Can co:

- `admin_token`
- `payment_session_id`

Ket qua:

```json
{
  "payment": {},
  "refunds": []
}
```

## 6. Test Refund Qua Medusa Admin

Request:

- `Admin - Refund Payment (Core Medusa)`

Can co:

- `admin_token`
- `payment_id`: Medusa payment id, khong phai payment session id.
- `refund_amount_vnd`

Voi VNPay:

- Payment phai `paid` hoac `partially_refunded`.
- Can co `transaction_no` va `pay_date` tu callback thanh cong.
- Provider se goi VNPay refund API va ghi `vnpay_refund`.

Voi MoMo:

- Payment phai `paid` hoac `partially_refunded`.
- Can co `trans_id`.
- Provider se goi MoMo refund API va ghi `momo_refund`.
- Backend da chan refund vuot tong tien da thanh toan.

## 7. Test VNPay Gateway Sandbox

### 7.1. Build redirect payment URL

Request:

- `VNPay - Build Redirect Payment URL (PAY)`

Pre-request script tu tao:

- `vnpay_txn_ref`
- `vnpay_create_date`
- `vnpay_expire_date`
- `vnpay_amount_x100`
- `vnpay_payment_hash`

Luu y:

- VNPay yeu cau `vnp_Amount = amount_vnd * 100`.
- `vnp_BankCode` la optional. De trong neu muon khach tu chon phuong thuc tai VNPay.
- Neu muon test QR/ATM/card nhanh, co the dung `VNPAYQR`, `VNBANK`, `INTCARD` tuy sandbox ho tro.

### 7.2. Get bank list

Request:

- `VNPay - Get Bank List`

Can co:

- `vnpay_tmn_code`

Body form-urlencoded:

- `tmn_code={{vnpay_tmn_code}}`

Dung de lay danh sach `vnp_BankCode`.

### 7.3. QueryDR

Request:

- `VNPay - QueryDR Transaction`

Can co:

- `vnpay_tmn_code`
- `vnpay_hash_secret`
- `vnpay_txn_ref`
- `vnpay_transaction_date`

Optional:

- `vnpay_transaction_no`

Ket qua can doc:

- `vnp_ResponseCode = 00`: API query thanh cong.
- `vnp_TransactionStatus = 00`: giao dich thanh toan thanh cong.
- `vnp_ResponseCode = 91`: khong tim thay giao dich.
- `vnp_ResponseCode = 97`: checksum sai.

### 7.4. Refund

Request:

- `VNPay - Refund Transaction`

Can co:

- `vnpay_txn_ref`
- `vnpay_transaction_no`
- `vnpay_transaction_date`
- `refund_amount_vnd`
- `vnpay_refund_transaction_type`

Gia tri `vnpay_refund_transaction_type`:

- `02`: refund toan phan.
- `03`: refund mot phan.

Luu y sandbox:

- Mot so tai khoan sandbox co the han che refund.
- Neu `vnp_ResponseCode = 94`, co the request refund bi trung/da dang xu ly.
- Neu `vnp_TransactionStatus = 05` hoac `06`, refund dang xu ly/chuyen sang ngan hang.

## 8. Test MoMo Gateway Sandbox

### 8.1. Create payment

Request:

- `MoMo - Create Payment payWithMethod`

Can co:

- `momo_partner_code`
- `momo_access_key`
- `momo_secret_key`
- `momo_redirect_url`
- `momo_ipn_url`
- `amount_vnd`

Pre-request script tu tao:

- `momo_order_id`
- `momo_request_id`
- `momo_create_signature`

Ket qua mong doi:

- `resultCode = 0`
- co `payUrl` hoac `shortLink`

### 8.2. Query payment

Request:

- `MoMo - Query Payment Status`

Can co:

- `momo_order_id`
- `momo_request_id`

Ket qua quan trong:

- `resultCode = 0`: thanh cong.
- `resultCode = 9000`: authorized, can confirm/capture neu flow autoCapture=false.
- `resultCode = 1000/7000/7002`: pending/processing.

### 8.3. Refund

Request:

- `MoMo - Refund Transaction`

Can co:

- `momo_trans_id`: transId cua giao dich thanh cong.
- `refund_amount_vnd`.

MoMo yeu cau:

- `orderId` refund moi, khac orderId mua hang ban dau.
- `requestId` unique de idempotency.
- Minimum timeout nen la 30s theo docs.

### 8.4. Query refund

Request:

- `MoMo - Query Refund Result`

Can co:

- `momo_refund_order_id`
- `momo_refund_request_id`

Dung khi refund tra pending hoac can reconcile.

### 8.5. Confirm / Cancel authorized payment

Requests:

- `MoMo - Confirm Authorized Payment (capture)`
- `MoMo - Cancel Authorized Payment`

Chi dung cho flow duoc authorized, thuong la direct credit card / wallet voi `autoCapture=false`.

Gia tri:

- `requestType = capture`: chap nhan thu tien.
- `requestType = cancel`: huy giao dich authorized.

## 9. MoMo Extended Templates

Folder `04 - MoMo Extended API Templates` chua cac API chua gan backend:

- Tokenization callback token query.
- Tokenization delete token.
- Subscription callback token query.
- Disbursement balance.

Nhung request nay la template, khong phai luong da implement trong code hien tai.

Can them:

- Capability/contract MoMo tuong ung.
- RSA encrypted payload neu endpoint yeu cau.
- Quy tac signature chinh xac theo product MoMo duoc enable.
- Bang luu token/callbackToken/disbursement transaction trong backend neu muon production.

## 10. Loi Thuong Gap

### 10.1. Provider khong xuat hien

Kiem tra:

- Env day du.
- Da restart backend.
- Da chay enable provider script.
- Region currency la `vnd`.
- `publishable_key` dung sales channel.

### 10.2. VNPay invalid checksum

Kiem tra:

- `vnpay_hash_secret`.
- Dung amount x100.
- Khong sua query param sau khi script da ky.
- Thu tu ky: backend dung sorted query string va HMAC-SHA512.

### 10.3. MoMo invalid signature

Kiem tra:

- `momo_access_key`.
- `momo_secret_key`.
- `orderId`, `requestId`, `amount` co trung voi body.
- Khong sua body sau khi pre-request script da ky.

### 10.4. Refund failed

Kiem tra:

- Payment da paid/captured chua.
- VNPay co `transaction_no` va `pay_date/transaction_date`.
- MoMo co `trans_id`.
- Tong refund chua vuot amount.
- Sandbox account co du quyen refund khong.

## 11. Mapping File Code Hien Tai

- VNPay custom IPN: `my-medusa-store/apps/backend/src/api/hooks/payment/vnpay/route.ts`
- VNPay provider: `my-medusa-store/apps/backend/src/modules/vnpay/service.ts`
- VNPay ledger/audit: `my-medusa-store/apps/backend/src/modules/vnpay-payment/service.ts`
- MoMo provider: `my-medusa-store/apps/backend/src/modules/momo/service.ts`
- MoMo ledger/audit: `my-medusa-store/apps/backend/src/modules/momo-payment/service.ts`
- MoMo refund audit route: `my-medusa-store/apps/backend/src/api/admin/momo-refunds/route.ts`
- VNPay refund audit route: `my-medusa-store/apps/backend/src/api/admin/vnpay-refunds/route.ts`
- Bank Transfer provider: `my-medusa-store/apps/backend/src/modules/bank-transfer/service.ts`
