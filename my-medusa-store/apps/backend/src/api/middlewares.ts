import { defineMiddlewares } from "@medusajs/framework";
import { customerAdditionalDataSchema } from "../utils/customer-additional-data";

// Re-export validator shape for route middleware | Tái sử dụng shape từ schema dùng chung
// Tránh định nghĩa trùng lặp logic kiểm thực giữa tầng Middleware và Workflow
// Bridges shared schema shape to Medusa route-level additionalDataValidator contract

export const adminCreateCustomerAdditionalDataValidator = customerAdditionalDataSchema.shape;

// noinspection JSUnusedGlobalSymbols
export default defineMiddlewares({
  routes: [
    {
      methods: ["POST"],
      matcher: "/admin/customers",
      additionalDataValidator: adminCreateCustomerAdditionalDataValidator,
    },
  ],
});
