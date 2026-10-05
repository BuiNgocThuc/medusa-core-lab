import {
    authenticate,
    defineMiddlewares,
    validateAndTransformBody,
    validateAndTransformQuery,
} from "@medusajs/framework/http";
import { createFindParams, createSelectParams } from "@medusajs/medusa/api/utils/validators";
import { NextTierSchema } from "@/api/store/customers";
import { CreateTierSchema, UpdateTierSchema } from "@/api/admin/tiers";
import { ConditionalPromotionSchema } from "@/api/admin/conditional-promotions/validators";
import { FlashSaleSchema } from "@/api/admin/flash-sales/validators";
import { ClaimFlashSaleSchema } from "@/api/store/carts/[id]/flash-sales/validators";
import { RedeemLoyaltyPointsSchema } from "@/api/store/carts/[id]/loyalty-points/validators.ts";
import { customerAdditionalDataSchema } from "../utils/customer-additional-data";

export const adminCreateCustomerAdditionalDataValidator = customerAdditionalDataSchema.shape;

export default defineMiddlewares({
    routes: [
        {
            methods: ["POST"],
            matcher: "/admin/customers",
            additionalDataValidator: adminCreateCustomerAdditionalDataValidator,
        },
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
        {
            matcher: "/admin/conditional-promotions",
            methods: ["POST"],
            middlewares: [validateAndTransformBody(ConditionalPromotionSchema)],
        },
        {
            matcher: "/admin/conditional-promotions/:id",
            methods: ["POST"],
            middlewares: [validateAndTransformBody(ConditionalPromotionSchema)],
        },
        {
            matcher: "/admin/flash-sales",
            methods: ["POST"],
            middlewares: [validateAndTransformBody(FlashSaleSchema)],
        },
        {
            matcher: "/store/carts/:id/flash-sales/claim",
            methods: ["POST"],
            middlewares: [
                authenticate("customer", ["session", "bearer"]),
                validateAndTransformBody(ClaimFlashSaleSchema),
            ],
        },
        {
            matcher: "/store/carts/:id/flash-sales/claim",
            methods: ["DELETE"],
            middlewares: [authenticate("customer", ["session", "bearer"])],
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
            middlewares: [
                authenticate("customer", ["session", "bearer"]),
                validateAndTransformQuery(NextTierSchema, {}),
            ],
        },
        {
            matcher: "/store/customers/me/loyalty-points",
            methods: ["GET"],
            middlewares: [authenticate("customer", ["session", "bearer"])],
        },
        {
            matcher: "/store/customers/me/cart",
            methods: ["GET"],
            middlewares: [authenticate("customer", ["session", "bearer"])],
        },
        // get loyalty points
        {
            matcher: "/store/carts/:id/loyalty-points",
            methods: ["POST"],
            middlewares: [
                authenticate("customer", ["session", "bearer"]),
                validateAndTransformBody(RedeemLoyaltyPointsSchema),
            ],
        },
        {
            matcher: "/store/carts/:id/loyalty-points",
            methods: ["DELETE"],
            middlewares: [authenticate("customer", ["session", "bearer"])],
        },
        //...
        {
            matcher: "/store/carts/:id/merge-customer",
            method: "POST",
            middlewares: [
                authenticate("customer", ["session", "bearer"]),
                validateAndTransformQuery(createSelectParams(), {
                    defaults: [
                        "id",
                        "email",
                        "customer_id",
                        "items.*",
                        "region.*",
                        "shipping_address.*",
                    ],
                    isList: false,
                }),
            ],
        },
        {
            matcher: "/store/carts/restore-customer",
            method: "POST",
            middlewares: [authenticate("customer", ["session", "bearer"])],
        },
        {
            matcher: "/store/carts",
            middlewares: [
                (req: any, _res: any, next: any) => {
                    req.allowed = req.allowed || [];
                    req.allowed.push("custom", "custom.custom_name");
                    next();
                },
            ],
        },
        //..
    ],
});
