import {
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/customers/me/loyalty-points",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/carts/:id/loyalty-points",
      method: "POST",
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(z.object({ points: z.number().int().positive() })),
      ],
    },
  ],
})
