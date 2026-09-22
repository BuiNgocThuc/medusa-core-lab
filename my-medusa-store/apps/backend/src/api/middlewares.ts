import { authenticate, defineMiddlewares, validateAndTransformQuery } from "@medusajs/framework/http"
import { allowFields } from "@medusajs/framework/http"
import { createSelectParams } from "@medusajs/medusa/api/utils/validators"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/carts",
      middlewares: [allowFields("custom", "custom.custom_name"),],

    },
    {
      matcher: "/store/carts/:id/merge-customer",
      method: "POST",
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformQuery(
          createSelectParams(),
          {
            defaults: [ // có thể giúp khi đi vào route.ts dùng fields: req.queryConfig.fields, // <-- Tự động lấy các fields từ defaults hoặc từ ?fields của client
              "id",
              "email",
              "customer_id",
              "items.*",
              "region.*",
              "shipping_address.*",
            ],
            isList: false, // trả về 1, tránh các logic phân trang k cần thiết
          }
        ),
      ],
    },
    {
      matcher: "/store/carts/restore-customer",
      method: "POST",
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
      ],
    },
  ]
})


