import {
    authenticate,
    defineMiddlewares,
    validateAndTransformBody,
    validateAndTransformQuery,
} from "@medusajs/framework/http";
import { CreateTierSchema, UpdateTierSchema } from "@/src/api/admin/tiers";
import { createFindParams } from "@medusajs/medusa/api/utils/validators";
import { NextTierSchema } from "@/src/api/store/customers";

export default defineMiddlewares({
    routes: [
        // create tier
        {
            matcher: "/admin/tiers",
            methods: ["POST"],
            middlewares: [validateAndTransformBody(CreateTierSchema)],
        },
        // retrieve all tiers
        {
            matcher: "/admin/tiers",
            methods: ["GET"],
            middlewares: [
                validateAndTransformQuery(createFindParams(), {
                    isList: true,
                    defaults: ["id", "name", "promotion.id", "promotion.code"],
                }),
            ],
        },
        // retrieve tier by id
        {
            matcher: "/admin/tiers/:id",
            methods: ["GET"],
            middlewares: [
                validateAndTransformQuery(createFindParams(), {
                    isList: false,
                    defaults: ["id", "name", "promotion.id", "promotion.code", "tier_rules.*"],
                }),
            ],
        },
        // update tier
        {
            matcher: "/admin/tiers/:id",
            methods: ["POST"],
            middlewares: [validateAndTransformBody(UpdateTierSchema)],
        },
        // retrieve customers in tier
        {
            matcher: "/admin/tiers/:id/customers",
            methods: ["GET"],
            middlewares: [
                validateAndTransformQuery(createFindParams(), {
                    isList: true,
                    defaults: ["id", "email", "first_name", "last_name"],
                }),
            ],
        },
        // retrieve next tier
        {
            matcher: "/store/customers/me/next-tier",
            methods: ["GET"],
            middlewares: [validateAndTransformQuery(NextTierSchema, {})],
        },
        // get loyalty points
        {
            matcher: "/store/carts/:id/loyalty-points",
            methods: ["POST", "DELETE"],
            middlewares: [authenticate("customer", ["session", "bearer"])],
        },
        //...
    ],
});
