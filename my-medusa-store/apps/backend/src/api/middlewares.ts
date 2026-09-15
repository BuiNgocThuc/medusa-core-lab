import { defineMiddlewares, validateAndTransformQuery } from "@medusajs/framework/http"
import { allowFields } from "@medusajs/framework/http"
import { createSelectParams } from "@medusajs/medusa/api/utils/validators"

export default defineMiddlewares({
    routes:[
        {
        matcher : "/store/carts",
         middlewares:[allowFields("custom","custom.custom_name"),],
         
        },
        {
      matcher: "/store/carts/:id/merge-customer",
      method: "POST",
      middlewares: [
        validateAndTransformQuery(
          createSelectParams(),
          {
            defaults: [
              "id",
              "email",
              "customer_id",
              "items.*",
              "region.*",
              "shipping_address.*",
            ],
            isList: false,
          }
        ),
      ],
    }
    ]
})


