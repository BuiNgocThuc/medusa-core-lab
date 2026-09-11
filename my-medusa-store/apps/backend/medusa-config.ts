import { loadEnv, defineConfig } from '@medusajs/framework/utils'

import { BANK_TRANSFER_PAYMENT_MODULE } from "./src/modules/bank-transfer-payment"

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const REDIS_URL = process.env.REDIS_URL;


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
      resolve: "@medusajs/medusa/payment",
      dependencies: [BANK_TRANSFER_PAYMENT_MODULE],
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
