# VNPay Payment Implementation Guide

Updated: 2026-09-18

## 1. Overview

VNPay is implemented beside MoMo and Bank Transfer as a separate Medusa payment provider and ledger module.

Current implementation:

- Provider id: `pp_vnpay_default`.
- Backend provider: `my-medusa-store/apps/backend/src/modules/vnpay`.
- Ledger module: `my-medusa-store/apps/backend/src/modules/vnpay-payment`.
- Provider is registered only when `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, and `VNPAY_RETURN_URL` are set.
- Storefront redirects the customer to the VNPay `payment_url`.
- VNPay server-side IPN uses `GET /hooks/payment/vnpay`.
- Storefront return route is `/api/payment-return/vnpay` and is UX only. Payment truth is the server-side IPN/checksum result.

VNPay differs from MoMo:

```text
MoMo: backend calls create API -> receives payUrl
VNPay: backend builds signed payment URL -> customer opens VNPay
```

## 2. Source Files

Backend provider:

- `my-medusa-store/apps/backend/src/modules/vnpay/index.ts`
- `my-medusa-store/apps/backend/src/modules/vnpay/service.ts`
- `my-medusa-store/apps/backend/src/modules/vnpay/crypto.ts`
- `my-medusa-store/apps/backend/src/modules/vnpay/types.ts`

Backend ledger:

- `my-medusa-store/apps/backend/src/modules/vnpay-payment/index.ts`
- `my-medusa-store/apps/backend/src/modules/vnpay-payment/service.ts`
- `my-medusa-store/apps/backend/src/modules/vnpay-payment/types.ts`
- `my-medusa-store/apps/backend/src/modules/vnpay-payment/models/vnpay-payment.ts`
- `my-medusa-store/apps/backend/src/modules/vnpay-payment/models/vnpay-webhook-event.ts`
- `my-medusa-store/apps/backend/src/modules/vnpay-payment/migrations/Migration20260918090000.ts`

Routes and scripts:

- `my-medusa-store/apps/backend/src/api/hooks/payment/vnpay/route.ts`
- `my-medusa-store/apps/backend/src/migration-scripts/enable-vnpay-provider.ts`
- `my-medusa-store/apps/storefront/src/app/api/payment-return/vnpay/route.ts`

Storefront:

- `my-medusa-store/apps/storefront/src/lib/constants.tsx`
- `my-medusa-store/apps/storefront/src/modules/checkout/components/payment/index.tsx`
- `my-medusa-store/apps/storefront/src/modules/checkout/components/payment-button/index.tsx`

## 3. Environment

Sandbox:

```env
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_TMN_CODE=<sandbox-tmn-code>
VNPAY_HASH_SECRET=<sandbox-hash-secret>
VNPAY_RETURN_URL=http://localhost:8000/api/payment-return/vnpay
VNPAY_IPN_URL=https://<public-backend>/hooks/payment/vnpay
VNPAY_LOCALE=vn
VNPAY_ORDER_TYPE=other
VNPAY_PAYMENT_EXPIRY_MINUTES=15
```

Production:

```env
VNPAY_PAYMENT_URL=https://pay.vnpay.vn/vpcpay.html
VNPAY_TMN_CODE=<production-tmn-code>
VNPAY_HASH_SECRET=<production-hash-secret>
VNPAY_RETURN_URL=https://<production-storefront>/api/payment-return/vnpay
VNPAY_IPN_URL=https://<production-backend>/hooks/payment/vnpay
```

VNPay IPN must be public HTTPS in sandbox/production. The local return URL may work for browser redirect during local sandbox testing, but server-side IPN cannot call `localhost`.

## 4. Checkout Flow

```text
Customer selects VNPay
-> Storefront initiates payment session pp_vnpay_default
-> Provider generates vnp_TxnRef
-> Provider builds signed VNPay URL
-> Ledger stores vnpay_payment=pending
-> Storefront continues to Review
-> Customer clicks Pay with VNPay
-> Browser opens payment_url
-> VNPay calls GET /hooks/payment/vnpay
-> Backend verifies checksum/amount/txnRef
-> Ledger marks paid/failed/manual_review
-> Backend runs Medusa authorized + captured workflow on success
-> VNPay redirects browser to /api/payment-return/vnpay
```

## 5. Signature

Payment URL:

- Sort `vnp_*` params by key.
- Exclude `vnp_SecureHash` and `vnp_SecureHashType`.
- Build query string.
- Sign with HMAC SHA512 using `VNPAY_HASH_SECRET`.
- Append `vnp_SecureHash`.

Important VNPay detail:

- Medusa amount is stored as integer VND.
- VNPay `vnp_Amount` is `amount * 100`.
- On IPN, backend divides `vnp_Amount` by 100 before comparing with ledger amount.

## 6. State Mapping

| VNPay result | Ledger | Medusa action |
|---|---|---|
| `vnp_ResponseCode=00` and `vnp_TransactionStatus=00` | `paid` | `authorized` then `captured` |
| Invalid checksum | event `failed` | no payment mutation |
| Unknown `vnp_TxnRef` | event `ignored` | no payment mutation |
| Amount mismatch | `manual_review` | no payment mutation |
| Duplicate final payment | duplicate event | no second capture |
| Other response/status | `failed` | no paid state |

## 7. Enable Provider

After setting env and restarting backend:

```bash
cd my-medusa-store
pnpm --filter @dtc/backend exec medusa db:migrate
pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/enable-vnpay-provider.ts
```

Expected:

```text
[vnpay] Enabled pp_vnpay_default for 1 VND region(s).
```

## 8. Known Gaps

- Refund is currently marked `manual_required`; VNPay refund API is not implemented yet.
- Return route does not query trusted backend payment state yet.
- No VNPay reconciliation job is implemented yet.
- IPN route is custom GET because VNPay sends query params; MoMo still uses Medusa standard payment webhook POST.
