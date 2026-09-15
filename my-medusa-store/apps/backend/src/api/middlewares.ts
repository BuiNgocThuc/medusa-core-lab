import { defineMiddlewares } from "@medusajs/framework";
import { z } from "@medusajs/framework/zod";

export const adminCreateCustomerAdditionalDataValidator = {

  // Zalo UID assumption: 8-20 digit numeric string
  zalo_id: z.string()
    .regex(/^[0-9]{8,20}$/)
    .optional(),

  // Enforce http/https explicitly - bare z.url() does not restrict protocol in Zod 4
  avatar_url: z.url({ protocol: /^https?$/ }).optional(),

};

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
