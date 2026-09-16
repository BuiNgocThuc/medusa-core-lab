import { loadEnv, defineConfig } from '@medusajs/framework/utils'

import { BANK_TRANSFER_PAYMENT_MODULE } from "./src/modules/bank-transfer-payment"
import { MOMO_PAYMENT_MODULE } from "./src/modules/momo-payment"

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const REDIS_URL = process.env.REDIS_URL;
const MOMO_REAL_CONFIGURED = Boolean(
  process.env.MOMO_PARTNER_CODE &&
    process.env.MOMO_ACCESS_KEY &&
    process.env.MOMO_SECRET_KEY &&
    process.env.MOMO_REDIRECT_URL &&
    process.env.MOMO_IPN_URL
)
const MOMO_MOCK_ENABLED =
  process.env.MOMO_MOCK_ENABLED === "true" ||
  (process.env.NODE_ENV !== "production" &&
    process.env.MOMO_MOCK_ENABLED !== "false" &&
    !MOMO_REAL_CONFIGURED)
const MOMO_ENABLED = Boolean(
  MOMO_MOCK_ENABLED || MOMO_REAL_CONFIGURED
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
      resolve: "@medusajs/medusa/payment",
      dependencies: [BANK_TRANSFER_PAYMENT_MODULE, MOMO_PAYMENT_MODULE],
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
          ...(MOMO_ENABLED
            ? [
                {
                  resolve: "./src/modules/momo",
                  id: "default",
                  options: {
                    providerId: "pp_momo_default",
                    partnerCode:
                      process.env.MOMO_PARTNER_CODE || "MOMO_MOCK_PARTNER",
                    accessKey: process.env.MOMO_ACCESS_KEY || "MOMO_MOCK_ACCESS",
                    secretKey: process.env.MOMO_SECRET_KEY || "MOMO_MOCK_SECRET",
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
                    requestType: "captureWallet",
                    autoCapture: process.env.MOMO_AUTO_CAPTURE !== "false",
                    lang: (process.env.MOMO_LANG || "vi") as "vi" | "en",
                    orderExpireTimeMinutes: Number(
                      process.env.MOMO_ORDER_EXPIRE_MINUTES || 15
                    ),
                    mockEnabled: MOMO_MOCK_ENABLED,
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
