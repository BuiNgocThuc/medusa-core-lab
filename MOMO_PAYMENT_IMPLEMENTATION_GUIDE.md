# MoMo Payment Implementation Guide

Updated: 2026-09-17

## 1. Overview

This repo now includes an initial MoMo payment integration for MedusaJS v2. It is implemented beside the existing Bank Transfer provider, not on top of it.

Current implementation status as of 2026-09-17:

- Backend has `momo` payment provider and `momo-payment` ledger module.
- Provider id is `pp_momo_default`.
- Provider is registered only when all required real MoMo variables are present: `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `MOMO_REDIRECT_URL`, `MOMO_IPN_URL`.
- Current configured `requestType` in `medusa-config.ts` is `payWithMethod`. The code types still support `captureWallet`, but the running config is not `captureWallet` unless changed in provider options.
- There is no automatic mock provider fallback in `medusa-config.ts`.
- Storefront redirects customer to `pay_url`/`short_link`, or mobile `deeplink`, from the active MoMo payment session.
- `/api/payment-return/momo` is currently UX routing only; it redirects back to checkout based on `resultCode`. It does not query trusted backend payment state yet.
- Standard MoMo IPN path is `POST /hooks/payment/momo_default`.
- `reconcile-momo-payments` runs every 5 minutes and can repair successful MoMo payments by querying MoMo.

MoMo is treated as a payment gateway flow:

```text
checkout -> create MoMo payment -> redirect/payUrl -> MoMo IPN -> verify signature -> ledger -> Medusa payment workflow
```

The redirect back to storefront is only UX. Payment truth comes from MoMo IPN or server-side transaction query.

## 2. Project Files

Backend provider:

- `my-medusa-store/apps/backend/src/modules/momo/index.ts`
- `my-medusa-store/apps/backend/src/modules/momo/service.ts`
- `my-medusa-store/apps/backend/src/modules/momo/client.ts`
- `my-medusa-store/apps/backend/src/modules/momo/crypto.ts`
- `my-medusa-store/apps/backend/src/modules/momo/types.ts`

Backend ledger:

- `my-medusa-store/apps/backend/src/modules/momo-payment/index.ts`
- `my-medusa-store/apps/backend/src/modules/momo-payment/service.ts`
- `my-medusa-store/apps/backend/src/modules/momo-payment/types.ts`
- `my-medusa-store/apps/backend/src/modules/momo-payment/models/momo-payment.ts`
- `my-medusa-store/apps/backend/src/modules/momo-payment/models/momo-webhook-event.ts`
- `my-medusa-store/apps/backend/src/modules/momo-payment/models/momo-refund.ts`
- `my-medusa-store/apps/backend/src/modules/momo-payment/migrations/Migration20260915120000.ts`
- `my-medusa-store/apps/backend/src/modules/momo-payment/migrations/Migration20260915123000.ts`

Webhook and jobs:

- Standard Medusa webhook path: `POST /hooks/payment/momo_default`
- `my-medusa-store/apps/backend/src/jobs/reconcile-momo-payments.ts`
- `my-medusa-store/apps/backend/src/migration-scripts/enable-momo-provider.ts`

Storefront:

- `my-medusa-store/apps/storefront/src/lib/constants.tsx`
- `my-medusa-store/apps/storefront/src/modules/checkout/components/payment/index.tsx`
- `my-medusa-store/apps/storefront/src/modules/checkout/components/payment-button/index.tsx`
- `my-medusa-store/apps/storefront/src/app/api/payment-return/momo/route.ts`

## 3. Environment Variables

Personal demo without MoMo credentials:

There is currently no working mock provider fallback in `medusa-config.ts`. Leave MoMo credentials empty so the backend does not register `pp_momo_default`, and use `pp_system_default` or Bank Transfer for local checkout demos.

Do not copy placeholder values like `<your-momo-partner-code>` into a real `.env` and leave them there. The current config checks whether variables are non-empty, so placeholders make the app try to register and call MoMo with invalid credentials.

Development/sandbox with real MoMo credentials:

```bash
MOMO_ENDPOINT=https://test-payment.momo.vn
MOMO_PARTNER_CODE=<sandbox-partner-code>
MOMO_ACCESS_KEY=<sandbox-access-key>
MOMO_SECRET_KEY=<sandbox-secret-key>
MOMO_PARTNER_NAME=Medusa Store
MOMO_STORE_ID=MedusaStore
MOMO_REDIRECT_URL=https://<storefront-public-url>/api/payment-return/momo
MOMO_IPN_URL=https://<backend-public-url>/hooks/payment/momo_default
MOMO_AUTO_CAPTURE=true
MOMO_LANG=vi
MOMO_ORDER_EXPIRE_MINUTES=15
```

Production:

```bash
MOMO_ENDPOINT=https://payment.momo.vn
MOMO_PARTNER_CODE=<production-partner-code>
MOMO_ACCESS_KEY=<production-access-key>
MOMO_SECRET_KEY=<production-secret-key>
MOMO_REDIRECT_URL=https://<production-storefront>/api/payment-return/momo
MOMO_IPN_URL=https://<production-backend>/hooks/payment/momo_default
```

The provider is registered when all required real MoMo variables are present.

## 4. Provider Registration

`medusa-config.ts` registers:

- Ledger module: `./src/modules/momo-payment`
- Payment provider: `./src/modules/momo`, only when required MoMo env vars are non-empty.
- Provider id: `pp_momo_default`

Enable the provider for VND regions after credentials are configured and backend has been restarted:

```bash
cd my-medusa-store
pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/enable-momo-provider.ts
```

## 5. Database Schema

`momo_payment` stores the gateway order/request and Medusa payment session mapping.

It also stores wallet/gateway fields such as `deeplink_mini_app`, `user_fee`, `payment_option`, and `order_type` when MoMo returns them.

Important uniqueness:

- `payment_session_id`
- `momo_order_id`
- `request_id`
- partial unique `trans_id`

`momo_webhook_event` stores incoming IPN/query-derived events.

Important uniqueness:

- `event_key`

`momo_refund` stores refund attempts.

Important uniqueness:

- `refund_order_id`
- `request_id`

## 6. Checkout Flow

1. Storefront lists payment providers from Medusa.
2. Customer selects `pp_momo_default`.
3. Storefront initiates a payment session.
4. Backend provider calls MoMo `POST /v2/gateway/api/create` with the configured `requestType`. Current config uses `payWithMethod`.
5. Provider returns `pay_url`, `short_link`, `deeplink`, `qr_code_url`, gateway ids and expiry in payment session data.
6. Checkout shows amount/expiry/method, then review shows `Pay with MoMo`.
7. Storefront button chooses mobile `deeplink` when possible, otherwise `pay_url`/`short_link`, and appends `cart_id`/`country_code` to the URL for return context.

## 7. IPN Flow

MoMo calls the standard Medusa payment webhook route:

```text
POST /hooks/payment/momo_default
```

Medusa resolves the provider from the path and calls `MomoPaymentProviderService.getWebhookActionAndData(...)`. The provider:

1. Validates required fields.
2. Verifies `partnerCode`.
3. Rebuilds MoMo HMAC SHA256 signature data.
4. Compares signatures with timing-safe comparison.
5. Records webhook event in `momo_webhook_event`.
6. Matches `orderId`, `requestId`, and `amount` against `momo_payment`.
7. Marks the ledger as `paid`, `authorized`, `pending`, `failed`, or `manual_review`.
8. Returns a Medusa webhook action. `resultCode=0` maps to `captured`, `resultCode=9000` maps to `authorized`, failed final result codes map to `failed`, and pending/duplicate/manual-review states map to `not_supported`.

Duplicate IPNs are acknowledged and do not trigger duplicate workflow processing.

## 8. Signature Verification

Create-payment request signature raw string:

```text
accessKey=$accessKey&amount=$amount&extraData=$extraData&ipnUrl=$ipnUrl&orderId=$orderId&orderInfo=$orderInfo&partnerCode=$partnerCode&redirectUrl=$redirectUrl&requestId=$requestId&requestType=$requestType
```

IPN signature raw string:

```text
accessKey=$accessKey&amount=$amount&extraData=$extraData&message=$message&orderId=$orderId&orderInfo=$orderInfo&orderType=$orderType&partnerCode=$partnerCode&payType=$payType&requestId=$requestId&responseTime=$responseTime&resultCode=$resultCode&transId=$transId
```

The implementation lives in:

```text
my-medusa-store/apps/backend/src/modules/momo/crypto.ts
```

## 9. Reconciliation

Job:

```text
reconcile-momo-payments
```

Schedule:

```text
*/5 * * * *
```

It queries `initiated`, `pending`, and `authorized` MoMo payments using `POST /v2/gateway/api/query`. If MoMo reports success with a `transId`, the job records a query-derived event and repairs Medusa payment state by running `authorized` and `captured`.

## 10. Refund

`refundPayment()` requires a paid MoMo payment with `transId`.

It calls:

```text
POST /v2/gateway/api/refund
```

The refund request/response is stored in `momo_refund`. A `resultCode=0` refund is returned to Medusa as successful. Other result codes raise a Medusa error.

## 11. Local Development

1. Install dependencies:

```bash
cd my-medusa-store
pnpm install
```

2. Start database/redis:

```bash
docker compose up -d
```

3. Configure `.env` from `.env.template`.

4. If using real MoMo sandbox, expose backend with HTTPS tunnel for MoMo IPN:

```text
https://<backend-public-url>/hooks/payment/momo_default
```

5. Expose or configure storefront redirect:

```text
https://<storefront-public-url>/api/payment-return/momo
```

6. Run migrations:

```bash
pnpm --filter @dtc/backend exec medusa db:migrate
```

7. Enable provider only after all required MoMo env vars are set:

```bash
pnpm --filter @dtc/backend exec medusa exec ./src/migration-scripts/enable-momo-provider.ts
```

8. Start backend and storefront.

There is no local MoMo mock mode in the current backend config. For real sandbox testing, a public HTTPS backend URL is required for IPN.

## 12. Manual Sandbox Test

Happy path:

1. Add product to cart.
2. Fill address/shipping.
3. Select MoMo.
4. Confirm payment session shows MoMo order/request.
5. Click `Pay with MoMo`.
6. Complete payment in sandbox.
7. Confirm IPN arrives at backend.
8. Confirm order payment is authorized/captured.
9. Confirm `momo_payment.status = paid`.

Failure path:

1. Start checkout and open MoMo payment.
2. Cancel or let it fail.
3. Confirm order is not marked paid.
4. Confirm `momo_payment.status = failed` or remains pending until reconciliation.

Duplicate IPN:

1. Re-send the same IPN payload.
2. Confirm `momo_webhook_event` stores duplicate/ignored state.
3. Confirm no second capture/refund/payment mutation.

## 13. Production Checklist

DEV ONLY:

- Sandbox MoMo credentials.
- Local tunnel URLs.
- Verbose debugging.

PRODUCTION REQUIRED:

- Production MoMo endpoint: `https://payment.momo.vn`.
- HTTPS backend and storefront.
- Separate production credentials.
- Secrets stored outside git.
- IPN signature verification enabled.
- Idempotency via DB unique constraints.
- Logs must mask signatures and secrets.
- Alerts for invalid signature spikes, stuck pending payments, MoMo API failures, and refund failures.
- Rollback disables `pp_momo_default` first while keeping IPN route alive for late callbacks.

## 14. Verification

Build check:

```bash
cd my-medusa-store
pnpm --filter @dtc/backend build
```

Expected warnings are limited to unrelated existing seed-file lint warnings.
