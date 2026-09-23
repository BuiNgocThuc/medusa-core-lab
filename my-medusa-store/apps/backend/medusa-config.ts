/**
 * Cấu hình Medusa Backend:
 * - Đăng ký các custom payment modules (bank-transfer-payment, momo-payment, vnpay-payment).
 * - Đăng ký providers vào Medusa Payment Module (bank-transfer luôn bật, momo & vnpay bật khi đủ env).
 */
import { loadEnv, defineConfig } from '@medusajs/framework/utils'

import { BANK_TRANSFER_PAYMENT_MODULE } from "./src/modules/bank-transfer-payment"
import { MOMO_PAYMENT_MODULE } from "./src/modules/momo-payment"
import { VNPAY_PAYMENT_MODULE } from "./src/modules/vnpay-payment"

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const REDIS_URL = process.env.REDIS_URL;
const MOMO_REAL_CONFIGURED = Boolean(
  process.env.MOMO_PARTNER_CODE &&
    process.env.MOMO_ACCESS_KEY &&
    process.env.MOMO_SECRET_KEY &&
    process.env.MOMO_REDIRECT_URL &&
    process.env.MOMO_IPN_URL
)
const VNPAY_REAL_CONFIGURED = Boolean(
  process.env.VNPAY_TMN_CODE &&
    process.env.VNPAY_HASH_SECRET &&
    process.env.VNPAY_RETURN_URL
)
module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },

  admin: {
    disable: process.env.MEDUSA_ADMIN_DISABLED === "true",
  },

  modules: [
    {
      resolve: "./src/modules/bank-transfer-payment",
    },
    {
      resolve: "./src/modules/momo-payment",
    },
    {
      resolve: "./src/modules/vnpay-payment",
    },
    {
      resolve: "@medusajs/medusa/payment",
      dependencies: [
        BANK_TRANSFER_PAYMENT_MODULE,
        MOMO_PAYMENT_MODULE,
        VNPAY_PAYMENT_MODULE,
      ],
      options: {
        providers: [
          {
            resolve: "./src/modules/bank-transfer",
            id: "default",
            options: {
              providerId: "pp_bank-transfer_default",
              bankName: process.env.BANK_TRANSFER_BANK_NAME || "Demo Bank",
              accountNumber:
                process.env.BANK_TRANSFER_ACCOUNT_NUMBER || "0000000000",
              accountName:
                process.env.BANK_TRANSFER_ACCOUNT_NAME ||
                "MEDUSA DEMO MERCHANT",
              referencePrefix:
                process.env.BANK_TRANSFER_REFERENCE_PREFIX || "PAY",
              paymentExpiryMinutes: Number(
                process.env.BANK_TRANSFER_EXPIRY_MINUTES || 30
              ),
              webhookSecret: process.env.BANK_TRANSFER_WEBHOOK_SECRET,
            },
          },
          ...(MOMO_REAL_CONFIGURED
            ? [
                {
                  resolve: "./src/modules/momo",
                  id: "default",
                  options: {
                    providerId: "pp_momo_default",
                    partnerCode: process.env.MOMO_PARTNER_CODE,
                    accessKey: process.env.MOMO_ACCESS_KEY,
                    secretKey: process.env.MOMO_SECRET_KEY,
                    endpoint:
                      process.env.MOMO_ENDPOINT ||
                      "https://test-payment.momo.vn",
                    partnerName:
                      process.env.MOMO_PARTNER_NAME || "Medusa Store",
                    storeId: process.env.MOMO_STORE_ID || "MedusaStore",
                    redirectUrl:
                      process.env.MOMO_REDIRECT_URL ||
                      "http://localhost:8000/api/payment-return/momo",
                    ipnUrl:
                      process.env.MOMO_IPN_URL ||
                      "http://localhost:9001/hooks/payment/momo_default",
                    requestType: "payWithMethod",
                    autoCapture: process.env.MOMO_AUTO_CAPTURE !== "false",
                    lang: (process.env.MOMO_LANG || "vi") as "vi" | "en",
                    orderExpireTimeMinutes: Number(
                      process.env.MOMO_ORDER_EXPIRE_MINUTES || 15
                    ),
                  },
                },
              ]
            : []),
          ...(VNPAY_REAL_CONFIGURED
            ? [
                {
                  resolve: "./src/modules/vnpay",
                  id: "default",
                  options: {
                    providerId: "pp_vnpay_default",
                    tmnCode: process.env.VNPAY_TMN_CODE,
                    hashSecret: process.env.VNPAY_HASH_SECRET,
                    paymentUrl:
                      process.env.VNPAY_PAYMENT_URL ||
                      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
                    transactionApiUrl:
                      process.env.VNPAY_TRANSACTION_API_URL ||
                      "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
                    returnUrl:
                      process.env.VNPAY_RETURN_URL ||
                      "http://localhost:8000/api/payment-return/vnpay",
                    ipnUrl:
                      process.env.VNPAY_IPN_URL ||
                      "http://localhost:9001/hooks/payment/vnpay",
                    locale: (process.env.VNPAY_LOCALE || "vn") as "vn" | "en",
                    orderType: process.env.VNPAY_ORDER_TYPE || "other",
                    paymentExpiryMinutes: Number(
                      process.env.VNPAY_PAYMENT_EXPIRY_MINUTES || 15
                    ),
                    refundCreateBy: process.env.VNPAY_REFUND_CREATE_BY || "system",
                    refundIpAddress:
                      process.env.VNPAY_REFUND_IP_ADDRESS || "127.0.0.1",
                  },
                },
              ]
            : []),
        ],
      },
    },
    // --- STORAGE: Dùng Cloudflare R2 để lưu ảnh sản phẩm ---- Bỏ vào modules[]
    ...(process.env.S3_BUCKET
        ? [
          {
            resolve: "@medusajs/medusa/file",
            options: {
              providers: [
                {
                  resolve: "@medusajs/medusa/file-s3",
                  id: "s3",
                  options: {
                    file_url: process.env.S3_FILE_URL,
                    access_key_id: process.env.S3_ACCESS_KEY_ID,
                    secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
                    region: process.env.S3_REGION,
                    bucket: process.env.S3_BUCKET,
                    endpoint: process.env.S3_ENDPOINT,
                    additional_client_config: {
                      forcePathStyle: true,
                    },
                  },
                },
              ],
            },
          },
        ]
        : []),
  ]
})
