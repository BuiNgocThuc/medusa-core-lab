import { defineMiddlewares } from "@medusajs/framework/http"
import { allowFields } from "@medusajs/framework/http"

export default defineMiddlewares({
    routes:[
        {
        matcher : "/store/carts",
         middlewares:[allowFields("custom","custom.custom_name"),],
         
        }
    ]
})


