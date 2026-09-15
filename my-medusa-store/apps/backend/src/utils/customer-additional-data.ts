import { z } from "@medusajs/framework/zod";

// Shared contract for customer additional data | Hợp đồng dùng chung cho dữ liệu mở rộng khách hàng
// Định nghĩa schema kiểm thực tập trung cho cả tầng API Middleware và Workflow Hook
// Enforces validation boundary across HTTP middleware and direct workflow invocations

// noinspection JSUnusedGlobalSymbols
export const customerAdditionalDataSchema = z.object({

  zalo_id: z.string().regex(/^[0-9]{8,20}$/, "Zalo ID must be a numeric string of 8 to 20 digits").optional(),

  avatar_url: z.url({ protocol: /^https?$/ }).optional(),

});

// noinspection JSUnusedGlobalSymbols
export type CustomerAdditionalData = z.infer<typeof customerAdditionalDataSchema>;