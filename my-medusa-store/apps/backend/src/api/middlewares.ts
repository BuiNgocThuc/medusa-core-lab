import {
    allowFields,
    authenticate,
    defineMiddlewares,
    validateAndTransformBody,
    validateAndTransformQuery,
} from "@medusajs/framework/http";
import { createFindParams, createSelectParams } from "@medusajs/medusa/api/utils/validators";
import { NextTierSchema } from "@/src/api/store/customers";
import { CreateTierSchema, UpdateTierSchema } from "@/src/api/admin/tiers";
import { RedeemLoyaltyPointsSchema } from "@/src/api/store/carts/[id]/loyalty-points/validators.ts";

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

        },
        //..
    ],
});
