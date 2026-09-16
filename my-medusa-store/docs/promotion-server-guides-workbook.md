# Promotion Module — Workbook code tay

Mỗi bước: đọc mục tiêu, tạo đúng file, rồi gõ code ngay bên dưới. Code được lấy từ source hiện tại.

## A1. Tier Module — dữ liệu và service

### `apps/backend/src/modules/tier/models/tier.ts`

**Vai trò:** Định nghĩa Tier: tên, promo_id và danh sách rules.

```ts
import { model } from "@medusajs/framework/utils";
import { TierRule } from "./tier-rule";

export const Tier = model.define("tier", {
    id: model.id().primaryKey(),
    name: model.text(),
    promo_id: model.text().nullable(),
    tier_rules: model.hasMany(() => TierRule, {
        mappedBy: "tier",
    }),
});
```

### `apps/backend/src/modules/tier/models/tier-rule.ts`

**Vai trò:** Định nghĩa ngưỡng chi tiêu theo currency; unique một rule/tier/currency.

```ts
import { model } from "@medusajs/framework/utils";
import { Tier } from "./tier";

export const TierRule = model
    .define("tier_rule", {
        id: model.id().primaryKey(),
        min_purchase_value: model.number(),
        currency_code: model.text(),
        tier: model.belongsTo(() => Tier, {
            mappedBy: "tier_rules",
        }),
    })
    .indexes([
        {
            on: ["tier_id", "currency_code"],
            unique: true,
        },
    ]);
```

### `apps/backend/src/modules/tier/service.ts`

**Vai trò:** Tính tier hiện tại và tier kế tiếp từ tổng purchase value.

```ts
import { MedusaService } from "@medusajs/framework/utils";
import { Tier } from "./models/tier";
import { TierRule } from "./models/tier-rule";

class TierModuleService extends MedusaService({
    Tier,
    TierRule,
}) {
    async calculateQualifyingTier(currencyCode: string, purchaseValue: number) {
        const rules = await this.listTierRules({
            currency_code: currencyCode,
        });

        if (!rules || rules.length === 0) {
            return null;
        }

        const sortedRules = rules.sort((a, b) => b.min_purchase_value - a.min_purchase_value);

        const qualifyingRule = sortedRules.find((rule) => purchaseValue >= rule.min_purchase_value);

        return qualifyingRule?.tier?.id || null;
    }

    async calculateNextTierUpgrade(currencyCode: string, currentPurchaseValue: number) {
        const rules = await this.listTierRules(
            {
                currency_code: currencyCode,
            },
            {
                relations: ["tier"],
            },
        );

        // Sort rules by min_purchase_value ascending
        const sortedRules = rules.sort((a, b) => a.min_purchase_value - b.min_purchase_value);

        // Find the next tier the customer hasn't reached
        const nextRule = sortedRules.find((rule) => rule.min_purchase_value > currentPurchaseValue);

        if (!nextRule || !nextRule.tier) {
            return null;
        }

        const requiredAmount = nextRule.min_purchase_value - currentPurchaseValue;

        return {
            tier: nextRule.tier,
            required_amount: requiredAmount,
            current_purchase_value: currentPurchaseValue,
            next_tier_min_purchase: nextRule.min_purchase_value,
        };
    }
}

export default TierModuleService;
```

### `apps/backend/src/modules/tier/index.ts`

**Vai trò:** Đăng ký module với Medusa container bằng TIER_MODULE.

```ts
import TierModuleService from "./service";
import { Module } from "@medusajs/framework/utils";

export const TIER_MODULE = "tier";

export default Module(TIER_MODULE, {
    service: TierModuleService,
});
```

Checkpoint: chạy migration sau khi gõ model: `pnpm exec medusa db:generate tier` rồi `pnpm exec medusa db:migrate`.

## A2. Module Links

### `apps/backend/src/links/tier-customer.ts`

**Vai trò:** Liên kết Customer với Tier, không thêm tier_id trực tiếp vào Customer.

```ts
import { defineLink } from "@medusajs/framework/utils";
import TierModule from "../modules/tier";
import CustomerModule from "@medusajs/medusa/customer";

export default defineLink(
    {
        linkable: TierModule.linkable.tier,
        filterable: ["id"],
    },
    {
        linkable: CustomerModule.linkable.customer,
        isList: true,
    },
);
```

### `apps/backend/src/links/tier-promotion.ts`

**Vai trò:** Đọc Promotion của Tier qua promo_id.

```ts
import { defineLink } from "@medusajs/framework/utils";
import TierModule from "../modules/tier";
import PromotionModule from "@medusajs/medusa/promotion";

export default defineLink(
    {
        linkable: TierModule.linkable.tier,
        field: "promo_id",
    },
    PromotionModule.linkable.promotion,
    {
        readOnly: true,
    },
);
```

## A3. Admin tạo/sửa Tier

### `apps/backend/src/workflows/steps/create-tier.ts`

**Vai trò:** Tạo Tier và rollback nếu workflow lỗi.

```ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { TIER_MODULE } from "../../modules/tier";

export type CreateTierStepInput = {
    name: string;
    promo_id: string | null;
};

export const createTierStep = createStep(
    "create-tier",
    async (input: CreateTierStepInput, { container }) => {
        const tierModuleService = container.resolve(TIER_MODULE);

        const tier = await tierModuleService.createTiers({
            name: input.name,
            promo_id: input.promo_id || null,
        });

        return new StepResponse(tier, tier);
    },
    async (tier, { container }) => {
        if (!tier) {
            return;
        }

        const tierModuleService = container.resolve(TIER_MODULE);
        await tierModuleService.deleteTiers(tier.id);
    },
);
```

### `apps/backend/src/workflows/steps/create-tier-rules.ts`

**Vai trò:** Tạo TierRule và rollback rules đã tạo.

```ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { TIER_MODULE } from "../../modules/tier";

export type CreateTierRulesStepInput = {
    tier_id: string;
    tier_rules: Array<{
        min_purchase_value: number;
        currency_code: string;
    }>;
};

export const createTierRulesStep = createStep(
    "create-tier-rules",
    async (input: CreateTierRulesStepInput, { container }) => {
        const tierModuleService = container.resolve(TIER_MODULE);

        const createdRules = await tierModuleService.createTierRules(
            input.tier_rules.map((rule) => ({
                tier_id: input.tier_id,
                min_purchase_value: rule.min_purchase_value,
                currency_code: rule.currency_code,
            })),
        );

        return new StepResponse(createdRules, createdRules);
    },
    async (createdRules, { container }) => {
        if (!createdRules?.length) {
            return;
        }

        const tierModuleService = container.resolve(TIER_MODULE);
        await tierModuleService.deleteTierRules(createdRules.map((rule) => rule.id));
    },
);
```

### `apps/backend/src/workflows/create-tier.ts`

**Vai trò:** Ghép validation promotion, tạo tier/rules và trả tier đầy đủ.

```ts
import {
    createWorkflow,
    WorkflowResponse,
    transform,
    when,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { createTierStep } from "./steps/create-tier";
import { createTierRulesStep } from "./steps/create-tier-rules";

export type CreateTierWorkflowInput = {
    name: string;
    promo_id?: string | null;
    tier_rules?: Array<{
        min_purchase_value: number;
        currency_code: string;
    }>;
};

export const createTierWorkflow = createWorkflow(
    "create-tier",
    (input: CreateTierWorkflowInput) => {
        // Validate promotion if provided
        when({ input }, (data) => !!data.input.promo_id).then(() => {
            useQueryGraphStep({
                entity: "promotion",
                fields: ["id"],
                filters: {
                    id: input.promo_id!,
                },
                options: {
                    throwIfKeyNotFound: true,
                },
            });
        });
        const promoId = transform({ input }, ({ input }) => input.promo_id || null);

        // Create the tier
        const tier = createTierStep({
            name: input.name,
            promo_id: promoId,
        });

        // Create tier rules if provided
        when({ input }, (data) => {
            return !!data.input.tier_rules?.length;
        }).then(() => {
            return createTierRulesStep({
                tier_id: tier.id,
                tier_rules: input.tier_rules!,
            });
        });

        // Retrieve the created tier with rules
        const { data: tiers } = useQueryGraphStep({
            entity: "tier",
            fields: ["*", "tier_rules.*"],
            filters: {
                id: tier.id,
            },
        }).config({ name: "retrieve-tier" });

        return new WorkflowResponse({
            tier: tiers[0],
        });
    },
);
```

### `apps/backend/src/api/admin/tiers/route.ts`

**Vai trò:** POST tạo tier; GET list tier.

```ts
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "@medusajs/framework/zod";
import { createTierWorkflow } from "../../../workflows/create-tier";

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
    const query = req.scope.resolve("query");

    const { data: tiers, metadata } = await query.graph({
        entity: "tier",
        ...req.queryConfig,
    });

    res.json({
        tiers,
        count: metadata?.count || 0,
        offset: metadata?.skip || 0,
        limit: metadata?.take || 15,
    });
}

export const CreateTierSchema = z.object({
    name: z.string(),
    promo_id: z.string().nullable(),
    tier_rules: z.array(
        z.object({
            min_purchase_value: z.number(),
            currency_code: z.string(),
        }),
    ),
});

type CreateTierInput = z.infer<typeof CreateTierSchema>;

export async function POST(
    req: MedusaRequest<CreateTierInput>,
    res: MedusaResponse,
): Promise<void> {
    const { name, promo_id, tier_rules } = req.validatedBody;

    console.log("////", promo_id);

    const { result } = await createTierWorkflow(req.scope).run({
        input: {
            name,
            promo_id: promo_id || null,
            tier_rules: tier_rules || [],
        },
    });

    res.json({ tier: result.tier });
}
```

### `apps/backend/src/api/admin/tiers/[id]/route.ts`

**Vai trò:** GET detail; POST update tier.

```ts
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "@medusajs/framework/zod";
import { updateTierWorkflow } from "../../../../workflows/update-tier";

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
    const query = req.scope.resolve("query");
    const { id } = req.params;

    const { data: tiers } = await query.graph(
        {
            entity: "tier",
            filters: {
                id,
            },
            ...req.queryConfig,
        },
        {
            throwIfKeyNotFound: true,
        },
    );

    res.json({ tier: tiers[0] });
}

export const UpdateTierSchema = z.object({
    name: z.string(),
    promo_id: z.string().nullable(),
    tier_rules: z.array(
        z.object({
            min_purchase_value: z.number(),
            currency_code: z.string(),
        }),
    ),
});

type UpdateTierInput = z.infer<typeof UpdateTierSchema>;

export async function POST(
    req: MedusaRequest<UpdateTierInput>,
    res: MedusaResponse,
): Promise<void> {
    const { id } = req.params;
    const { name, promo_id, tier_rules } = req.validatedBody;

    const { result } = await updateTierWorkflow(req.scope).run({
        input: {
            id,
            name,
            promo_id: promo_id !== undefined ? promo_id : null,
            tier_rules: tier_rules || [],
        },
    });

    res.json({ tier: result.tier });
}
```

## A4. Gán tier sau order

### `apps/backend/src/workflows/steps/validate-customer.ts`

**Vai trò:** Chỉ registered customer được gán tier.

```ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";

export type ValidateCustomerStepInput = {
    customer: any;
};

export const validateCustomerStep = createStep(
    "validate-customer",
    async (input: ValidateCustomerStepInput, { container }) => {
        if (!input.customer) {
            throw new MedusaError(MedusaError.Types.NOT_FOUND, "Customer not found");
        }

        if (!input.customer.has_account) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Customer must be registered to be assigned a tier",
            );
        }

        return new StepResponse(input.customer);
    },
);
```

### `apps/backend/src/workflows/steps/determine-tier.ts`

**Vai trò:** Gọi service để tìm tier phù hợp.

```ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { TIER_MODULE } from "../../modules/tier";
import TierModuleService from "../../modules/tier/service";

export type DetermineTierStepInput = {
    currency_code: string;
    purchase_value: number;
};

export const determineTierStep = createStep(
    "determine-tier",
    async (input: DetermineTierStepInput, { container }) => {
        const tierModuleService: TierModuleService = container.resolve(TIER_MODULE);

        const qualifyingTier = await tierModuleService.calculateQualifyingTier(
            input.currency_code,
            input.purchase_value,
        );

        return new StepResponse(qualifyingTier);
    },
);
```

### `apps/backend/src/workflows/update-customer-tier-on-order.ts`

**Vai trò:** Tính tổng order hợp lệ cùng currency rồi thay Customer-Tier link.

```ts
import {
    createWorkflow,
    WorkflowResponse,
    transform,
    when,
} from "@medusajs/framework/workflows-sdk";
import {
    useQueryGraphStep,
    createRemoteLinkStep,
    dismissRemoteLinkStep,
} from "@medusajs/medusa/core-flows";
import { Modules, OrderStatus } from "@medusajs/framework/utils";
import { validateCustomerStep } from "./steps/validate-customer";
import { determineTierStep } from "./steps/determine-tier";
import { TIER_MODULE } from "../modules/tier";

type WorkflowInput = {
    order_id: string;
};

export const updateCustomerTierOnOrderWorkflow = createWorkflow(
    "update-customer-tier-on-order",
    (input: WorkflowInput) => {
        // Get order details
        const { data: orders } = useQueryGraphStep({
            entity: "order",
            fields: ["id", "currency_code", "total", "customer.*", "customer.tier.*"],
            filters: {
                id: input.order_id,
            },
            options: {
                throwIfKeyNotFound: true,
            },
        });

        const validatedCustomer = validateCustomerStep({
            customer: orders[0].customer,
        });

        // Query completed orders for the customer in the same currency
        const { data: completedOrders } = useQueryGraphStep({
            entity: "order",
            fields: ["id", "total", "currency_code"],
            filters: {
                customer_id: validatedCustomer.id,
                currency_code: orders[0].currency_code,
                status: {
                    $nin: [OrderStatus.CANCELED, OrderStatus.DRAFT],
                },
            },
        }).config({ name: "completed-orders" });

        // Calculate total purchase value using transform
        const purchasedValue = transform({ completedOrders }, (data) => {
            return data.completedOrders.reduce(
                (sum: number, order: any) => sum + (order.total || 0),
                0,
            );
        });

        // Determine appropriate tier
        const tierId = determineTierStep({
            currency_code: orders[0].currency_code as string,
            purchase_value: purchasedValue,
        });

        const existingTierId = transform(
            { orders },
            ({ orders }) => orders[0].customer?.tier?.id as string,
        );

        // Dismiss existing tier link if it exists
        // and the tier id is not the same as the tier id in the determine tier step
        when(
            { orders, tierId },
            (data) =>
                !!data.orders[0].customer?.tier?.id &&
                data.tierId !== data.orders[0].customer?.tier?.id,
        ).then(() => {
            dismissRemoteLinkStep([
                {
                    [TIER_MODULE]: { tier_id: existingTierId },
                    [Modules.CUSTOMER]: { customer_id: validatedCustomer.id },
                },
            ]);
        });

        // Create new tier link if tierId is provided
        when(
            { tierId, orders },
            (data) => !!data.tierId && data.orders[0].customer?.tier?.id !== data.tierId,
        ).then(() => {
            createRemoteLinkStep([
                {
                    [TIER_MODULE]: { tier_id: tierId },
                    [Modules.CUSTOMER]: { customer_id: validatedCustomer.id },
                },
            ]);
        });

        return new WorkflowResponse({
            customer_id: validatedCustomer.id,
            tier_id: tierId,
        });
    },
);
```

### `../apps/backend/src/subscribers/order-placed.ts`

**Vai trò:** Bắt event order.placed và chạy workflow.

```ts
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { updateCustomerTierOnOrderWorkflow } from "../workflows/update-customer-tier-on-order";

export default async function orderPlacedHandler({
    event: { data },
    container,
}: SubscriberArgs<{ id: string }>) {
    const logger = container.resolve("logger");
    try {
        await updateCustomerTierOnOrderWorkflow(container).run({
            input: {
                order_id: data.id,
            },
        });
    } catch (error) {
        logger.error(error);
    }
}

export const config: SubscriberConfig = {
    event: "order.placed",
};
```

## A5. Auto apply promotion tier vào cart

### `apps/backend/src/workflows/steps/validate-tier-promotion.ts`

**Vai trò:** Trả promotion code chỉ khi customer/tier/promotion hợp lệ.

```ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

export type ValidateTierPromotionStepInput = {
    customer: {
        has_account: boolean;
        tier?: {
            promo_id?: string | null;
            promotion?: {
                id?: string;
                code?: string | null;
                status?: string | null;
            } | null;
        } | null;
    } | null;
};

export const validateTierPromotionStep = createStep(
    "validate-tier-promotion",
    async (input: ValidateTierPromotionStepInput) => {
        if (!input.customer || !input.customer.has_account) {
            return new StepResponse(null);
        }

        const tier = input.customer.tier;

        if (!tier?.promo_id || !tier.promotion || tier.promotion.status !== "active") {
            return new StepResponse({ promotion_code: null });
        }

        return new StepResponse({
            promotion_code: tier.promotion.code || null,
        });
    },
);
```

### `apps/backend/src/workflows/add-tier-promotion-to-cart.ts`

**Vai trò:** Lock cart và ADD promotion tier nếu cart chưa có.

```ts
import {
    createWorkflow,
    WorkflowResponse,
    transform,
    when,
} from "@medusajs/framework/workflows-sdk";
import {
    acquireLockStep,
    releaseLockStep,
    updateCartPromotionsWorkflow,
    useQueryGraphStep,
} from "@medusajs/medusa/core-flows";
import { PromotionActions } from "@medusajs/framework/utils";
import { validateTierPromotionStep } from "./steps/validate-tier-promotion";

export type AddTierPromotionToCartWorkflowInput = {
    cart_id: string;
};

export const addTierPromotionToCartWorkflow = createWorkflow(
    "add-tier-promotion-to-cart",
    (input: AddTierPromotionToCartWorkflowInput) => {
        // Get cart with customer, tier, and promotions
        const { data: carts } = useQueryGraphStep({
            entity: "cart",
            fields: [
                "id",
                "customer.id",
                "customer.has_account",
                "customer.tier.*",
                "customer.tier.promotion.id",
                "customer.tier.promotion.code",
                "customer.tier.promotion.status",
                "promotions.*",
                "promotions.code",
            ],
            filters: {
                id: input.cart_id,
            },
            options: {
                throwIfKeyNotFound: true,
            },
        });

        acquireLockStep({
            key: input.cart_id,
            timeout: 2,
            ttl: 10,
        });

        // Check if customer exists and has tier
        // @ts-ignore
        const tierPromotionInput = transform({ carts }, ({ carts }) => ({
            has_account: carts[0].customer!.has_account,
            tier: {
                promo_id: carts[0].customer!.tier!.promo_id || null,
                promotion: {
                    id: carts[0].customer!.tier!.promotion!.id,
                    code: carts[0].customer!.tier!.promotion!.code || null,
                    status: carts[0].customer!.tier!.promotion!.status || null,
                },
            },
        }));

        const validationResult = when({ carts }, (data) => !!data.carts[0].customer).then(() => {
            return validateTierPromotionStep({
                customer: tierPromotionInput,
            });
        });

        // Add promotion to cart if valid and not already applied
        when({ validationResult, carts }, (data) => {
            if (!data.validationResult?.promotion_code) {
                return false;
            }

            const appliedPromotionCodes =
                data.carts[0].promotions?.map((promo: any) => promo.code) || [];

            return (
                data.validationResult?.promotion_code !== null &&
                !appliedPromotionCodes.includes(data.validationResult?.promotion_code!)
            );
        }).then(() => {
            const promoCodes = transform({ validationResult }, ({ validationResult }) => [
                validationResult?.promotion_code!,
            ]);

            return updateCartPromotionsWorkflow.runAsStep({
                input: {
                    cart_id: input.cart_id,
                    promo_codes: promoCodes,
                    action: PromotionActions.ADD,
                },
            });
        });

        releaseLockStep({
            key: input.cart_id,
        });

        return new WorkflowResponse(void 0);
    },
);
```

### `apps/backend/src/subscribers/cart-updated.ts`

**Vai trò:** Bắt cart.updated.

```ts
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { addTierPromotionToCartWorkflow } from "../workflows/add-tier-promotion-to-cart";

export default async function cartUpdatedHandler({
    event: { data },
    container,
}: SubscriberArgs<{ id: string }>) {
    await addTierPromotionToCartWorkflow(container).run({
        input: {
            cart_id: data.id,
        },
    });
}

export const config: SubscriberConfig = {
    event: "cart.updated",
};
```

## A6. Validation chung và Tier UI

### `apps/backend/src/workflows/hooks/validate-promotion.ts`

**Vai trò:** Một handler cho mỗi hook; kiểm tra cả Tier và First Purchase.

```ts
import { completeCartWorkflow, updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows";
import {
    ContainerRegistrationKeys,
    MedusaError,
    PromotionActions,
} from "@medusajs/framework/utils";
import { FIRST_PURCHASE_PROMOTION_CODE } from "../../constants";

async function validateFirstPurchase(cart: { customer_id?: string | null }, container: any) {
    if (!cart.customer_id) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "First purchase discount can only be applied to carts with a customer",
        );
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const {
        data: [customer],
    } = await query.graph({
        entity: "customer",
        fields: ["orders.*", "has_account"],
        filters: { id: cart.customer_id },
    });
    if (!customer.has_account || (customer?.orders?.length || 0) > 0) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "First purchase discount can only be applied to carts with no previous orders",
        );
    }
}

updateCartPromotionsWorkflow.hooks.validate(async ({ input, cart }, { container }) => {
    // Validation 1: first-purchase discount
    const hasFirstPurchasePromo = input.promo_codes?.some(
        (code) => code === FIRST_PURCHASE_PROMOTION_CODE,
    );
    if (hasFirstPurchasePromo) {
        await validateFirstPurchase(cart, container);
    }

    // Validation 2: customer-tier promotion
    if (
        (input.action !== PromotionActions.ADD && input.action !== PromotionActions.REPLACE) ||
        !input.promo_codes ||
        input.promo_codes.length === 0
    ) {
        return;
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const customerData = cart.customer_id
        ? await query.graph({
              entity: "customer",
              fields: ["id", "tier.*"],
              filters: { id: cart.customer_id },
          })
        : null;
    const customerTier = customerData?.data?.[0]?.tier;
    const { data: promotions } = await query.graph({
        entity: "promotion",
        fields: ["id", "code"],
        filters: { code: input.promo_codes },
    });
    const { data: tiers } = await query.graph({
        entity: "tier",
        fields: ["id", "promo_id"],
        filters: { promo_id: promotions.map((promotion) => promotion.id) },
    });

    for (const promotion of promotions) {
        const tierId = tiers.find((tier) => tier.promo_id === promotion.id)?.id;
        if (tierId && customerTier?.id !== tierId) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                `Promotion ${promotion.code || promotion.id} can only be applied by customers in the corresponding tier.`,
            );
        }
    }
});

completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
    // Validation 1: first-purchase discount
    const hasFirstPurchasePromo = cart.promotions?.some(
        (promo) => promo?.code === FIRST_PURCHASE_PROMOTION_CODE,
    );
    if (hasFirstPurchasePromo) {
        await validateFirstPurchase(cart, container);
    }

    // Validation 2: customer-tier promotion
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: detailedCarts } = await query.graph(
        {
            entity: "cart",
            fields: ["id", "promotions.*", "customer.id", "customer.tier.*"],
            filters: { id: cart.id },
        },
        { throwIfKeyNotFound: true },
    );
    const detailedCart = detailedCarts[0];

    if (!detailedCart?.promotions?.length) {
        return;
    }

    const { data: tiers } = await query.graph({
        entity: "tier",
        fields: ["id", "promo_id"],
        filters: {
            promo_id: detailedCart.promotions.flatMap((promotion) =>
                promotion?.id ? [promotion.id] : [],
            ),
        },
    });

    for (const promotion of detailedCart.promotions) {
        const tierId = tiers.find((tier) => tier.promo_id === promotion?.id)?.id;
        if (tierId && detailedCart.customer?.tier?.id !== tierId) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                `Promotion ${promotion?.code || promotion?.id} can only be applied by customers in the corresponding tier.`,
            );
        }
    }
});
```

### `apps/backend/src/api/store/customers/me/next-tier/route.ts`

**Vai trò:** Trả tier hiện tại và mốc upgrade kế tiếp.

```ts
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { TIER_MODULE } from "../../../../../modules/tier";
import { MedusaError } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
import { OrderStatus } from "@medusajs/framework/utils";

export const NextTierSchema = z.object({
    region_id: z.string(),
});

type NextTierInput = z.infer<typeof NextTierSchema>;

export async function GET(
    req: AuthenticatedMedusaRequest<{}, NextTierInput>,
    res: MedusaResponse,
): Promise<void> {
    // Validate customer is authenticated
    const customerId = req.auth_context?.actor_id;

    if (!customerId) {
        throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Customer must be authenticated");
    }

    const query = req.scope.resolve("query");
    const tierModuleService = req.scope.resolve(TIER_MODULE);

    // Get customer details to validate they're registered
    const {
        data: [customer],
    } = await query.graph(
        {
            entity: "customer",
            fields: ["id", "has_account", "tier.*"],
            filters: {
                id: customerId,
            },
        },
        {
            throwIfKeyNotFound: true,
        },
    );

    if (!customer.has_account) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Customer must be registered to view tier information",
        );
    }

    // Get currency code from cart or region context
    // Try to get from cart first, then region
    let regionId = req.validatedQuery.region_id;

    // Calculate total purchase value
    const { data: orders } = await query.graph({
        entity: "order",
        fields: ["id", "total", "currency_code"],
        filters: {
            customer_id: customerId,
            region_id: regionId,
            status: {
                $nin: [OrderStatus.CANCELED, OrderStatus.DRAFT],
            },
        },
    });

    // Get currency code from region if no orders
    let currencyCode: string | null = null;
    if (orders.length > 0) {
        currencyCode = orders[0].currency_code;
    } else {
        // Get currency from region
        const { data: regions } = await query.graph({
            entity: "region",
            fields: ["id", "currency_code"],
            filters: {
                id: regionId,
            },
        });

        if (regions && regions.length > 0) {
            currencyCode = regions[0].currency_code;
        }
    }

    const totalPurchaseValue =
        orders.length > 0
            ? orders.reduce((sum: number, order: any) => sum + (order.total || 0), 0)
            : 0;

    // Current tier is always the customer's assigned tier (null if not assigned)
    const currentTier = customer.tier || null;

    // Determine next tier upgrade
    let nextTierUpgrade = await tierModuleService.calculateNextTierUpgrade(
        currencyCode as string,
        totalPurchaseValue,
    );

    res.json({
        current_tier: currentTier,
        current_purchase_value: totalPurchaseValue,
        currency_code: currencyCode,
        next_tier_upgrade: nextTierUpgrade,
    });
}
```

### `apps/storefront/src/modules/common/customer-tier/index.tsx`

**Vai trò:** Progress UI của tier.

```tsx
import { convertToLocale } from "@lib/util/money";
import { clx } from "@medusajs/ui";
import { CustomerNextTier } from "types/tier";

type CustomerTierProps = {
    tierData: CustomerNextTier | null;
};

const CustomerTier = ({ tierData }: CustomerTierProps) => {
    if (!tierData) {
        return null;
    }

    const { current_tier, current_purchase_value, currency_code, next_tier_upgrade } = tierData;
    let progressPercentage = 100;
    let amountNeeded = 0;
    let minPurchaseValue = 0;
    let hasNextTier = false;
    let nextTierName = "";

    if (next_tier_upgrade && next_tier_upgrade.tier) {
        hasNextTier = true;
        nextTierName = next_tier_upgrade.tier.name;
        amountNeeded = next_tier_upgrade.required_amount;
        minPurchaseValue = next_tier_upgrade.next_tier_min_purchase;
        const currentPurchase = next_tier_upgrade.current_purchase_value;
        const nextMin = next_tier_upgrade.next_tier_min_purchase;

        if (nextMin > 0) {
            progressPercentage = Math.min(100, Math.max(0, (currentPurchase / nextMin) * 100));
        } else {
            progressPercentage = 100;
        }
    }

    if (!current_tier && !hasNextTier) {
        return null;
    }

    return (
        <div className="flex flex-col gap-y-4">
            <h3 className="text-large-semi">Membership Tier</h3>
            <div className="flex flex-col gap-y-3">
                {current_tier ? (
                    <div className="flex items-center gap-x-2">
                        <span className="text-large-semi" data-testid="current-tier-name">
                            {current_tier.name}
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-x-2">
                        <span
                            className="text-large-semi text-ui-fg-subtle"
                            data-testid="current-tier-name"
                        >
                            No tier
                        </span>
                    </div>
                )}
                {hasNextTier && (
                    <div className="flex flex-col gap-y-2">
                        <div className="flex justify-between text-small-regular text-ui-fg-subtle">
                            <span>Progress to {nextTierName}</span>
                            {amountNeeded > 0 ? (
                                <span>
                                    {convertToLocale({ amount: amountNeeded, currency_code })} to go
                                </span>
                            ) : (
                                <span className="text-ui-fg-interactive">Threshold reached!</span>
                            )}
                        </div>
                        <div className="flex">
                            <div
                                className={clx(
                                    "h-2 rounded-s-full transition-all duration-500 ease-in-out",
                                    progressPercentage >= 100
                                        ? "bg-gradient-to-r from-green-400 to-green-500"
                                        : "bg-gradient-to-r from-ui-fg-interactive to-ui-fg-interactive-hover",
                                    progressPercentage === 100 && "rounded-e-full",
                                )}
                                style={{ width: `${progressPercentage}%` }}
                                data-testid="tier-progress-bar"
                            />
                            <div
                                className={clx(
                                    "bg-gray-200 h-2 rounded-e-full flex-grow",
                                    progressPercentage === 0 && "rounded-s-full",
                                )}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-ui-fg-subtle">
                            <span>
                                {convertToLocale({
                                    amount:
                                        next_tier_upgrade?.current_purchase_value ||
                                        current_purchase_value,
                                    currency_code,
                                })}
                            </span>
                            {minPurchaseValue > 0 && (
                                <span>
                                    {convertToLocale({ amount: minPurchaseValue, currency_code })}
                                </span>
                            )}
                        </div>
                    </div>
                )}
                {!hasNextTier && current_tier && (
                    <div className="text-small-regular text-ui-fg-subtle">
                        You&apos;ve reached the highest tier!
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerTier;
```

## B1. First-Purchase Discount — constant, workflow, subscriber

### `apps/backend/src/constants.ts`

**Vai trò:** Mã FIRST_PURCHASE dùng chung bởi workflow và hook.

```ts
export const LOYALTY_PROMOTION_PREFIX = "LOYALTY";
export const LOYALTY_EARN_SPEND = 10_000;
export const LOYALTY_REDEMPTION_POINTS = 100;
export const LOYALTY_REDEMPTION_VALUE = 10_000;
export const FIRST_PURCHASE_PROMOTION_CODE = "FIRST_PURCHASE";
```

### `apps/backend/src/workflows/apply-first-purchase-promo.ts`

**Vai trò:** Tự ADD FIRST_PURCHASE cho registered customer chưa có order.

```ts
import { createWorkflow, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { updateCartPromotionsStep, useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { FIRST_PURCHASE_PROMOTION_CODE } from "../constants";
import { PromotionActions } from "@medusajs/framework/utils";

type WorkflowInput = { cart_id: string };

export const applyFirstPurchasePromoWorkflow = createWorkflow(
    "apply-first-purchase-promo",
    (input: WorkflowInput) => {
        const { data: carts } = useQueryGraphStep({
            entity: "cart",
            fields: ["promotions.*", "customer.*", "customer.orders.*"],
            filters: { id: input.cart_id },
        });
        const { data: promotions } = useQueryGraphStep({
            entity: "promotion",
            fields: ["code"],
            filters: { code: FIRST_PURCHASE_PROMOTION_CODE },
        }).config({ name: "retrieve-promotions" });

        when(
            { carts, promotions },
            (data) =>
                data.promotions.length > 0 &&
                !data.carts[0].promotions?.some((promo) => promo?.id === data.promotions[0].id) &&
                data.carts[0].customer !== null &&
                data.carts[0].customer.orders?.length === 0,
        ).then(() => {
            updateCartPromotionsStep({
                id: carts[0].id,
                promo_codes: [promotions[0].code!],
                action: PromotionActions.ADD,
            });
        });

        const { data: updatedCarts } = useQueryGraphStep({
            entity: "cart",
            fields: ["*", "promotions.*"],
            filters: { id: input.cart_id },
        }).config({ name: "retrieve-updated-cart" });

        return new WorkflowResponse(updatedCarts[0]);
    },
);
```

### `apps/backend/src/subscribers/apply-first-purchase.ts`

**Vai trò:** Chạy ở cart.created và cart.customer_transferred.

```ts
import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework";
import { applyFirstPurchasePromoWorkflow } from "../workflows/apply-first-purchase-promo";

export default async function cartCreatedHandler({
    event: { data },
    container,
}: SubscriberArgs<{ id: string }>) {
    await applyFirstPurchasePromoWorkflow(container).run({
        input: { cart_id: data.id },
    });
}

export const config: SubscriberConfig = {
    event: ["cart.created", "cart.customer_transferred"],
};
```

## B2. First-Purchase validation

Code nằm trong `validate-promotion.ts` ở A6. Không copy registration hook sang file khác.

## B3. First-Purchase popup UI

### `apps/storefront/src/modules/common/components/discount-popup/index.tsx`

**Vai trò:** Popup cho guest, lưu localStorage để hiện một lần.

```tsx
"use client";

import { Button, Heading, Text } from "@medusajs/ui";
import Modal from "@modules/common/components/modal";
import useToggleState from "@lib/hooks/use-toggle-state";
import { useEffect } from "react";
import LocalizedClientLink from "@modules/common/components/localized-client-link";

const DISCOUNT_POPUP_KEY = "discount_popup_shown";

const DiscountPopup = () => {
    const { state, open, close } = useToggleState(false);

    useEffect(() => {
        const hasBeenShown = localStorage.getItem(DISCOUNT_POPUP_KEY);
        if (!hasBeenShown) {
            open();
            localStorage.setItem(DISCOUNT_POPUP_KEY, "true");
        }
    }, [open]);

    return (
        <Modal isOpen={state} close={close} size="small" data-testid="discount-popup">
            <div className="relative overflow-hidden rounded-t-lg bg-gradient-to-br from-amber-50 to-amber-100 px-6 pb-6 pt-8">
                <div className="absolute right-0 top-0 h-20 w-20 -mr-10 -mt-10 rounded-full bg-amber-200 opacity-50" />
                <div className="absolute bottom-0 left-0 h-16 w-16 -mb-8 -ml-8 rounded-full bg-amber-200 opacity-40" />
                <div className="relative">
                    <div className="absolute -right-2 -top-2 rotate-12 rounded-full bg-rose-500 px-3 py-1 text-xs font-bold text-white shadow-md">
                        SAVE 10%
                    </div>
                    <Heading level="h2" className="text-center text-2xl font-bold text-amber-900">
                        Limited Time Offer!
                    </Heading>
                    <div className="my-4 flex justify-center">
                        <div className="relative">
                            <div className="text-5xl font-bold text-rose-600">10%</div>
                            <div className="mt-1 text-lg font-semibold text-amber-900">
                                OFF YOUR FIRST ORDER
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Modal.Body>
                <div className="flex flex-col items-center gap-y-6 bg-white px-6 py-6">
                    <Text className="text-center text-gray-700">
                        Sign up now to receive an exclusive 10% discount on your first purchase.
                        Join our community of satisfied customers!
                    </Text>
                    <div className="flex w-full flex-col gap-y-4">
                        <LocalizedClientLink href="/account" className="w-full">
                            <Button
                                variant="primary"
                                className="h-12 w-full font-semibold text-base shadow-md hover:shadow-lg transition-all"
                                onClick={close}
                            >
                                Register & Save 10%
                            </Button>
                        </LocalizedClientLink>
                        <Button
                            variant="secondary"
                            className="h-10 w-full font-medium"
                            onClick={close}
                        >
                            Maybe Later
                        </Button>
                    </div>
                    <div className="mt-2 text-center text-xs text-gray-400">
                        *Discount applies to your first order only
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default DiscountPopup;
```

### `apps/storefront/src/app/[countryCode]/(main)/layout.tsx`

**Vai trò:** Chỉ render popup khi chưa đăng nhập.

```tsx
import { Metadata } from "next";

import { listCartOptions, retrieveCart } from "@lib/data/cart";
import { retrieveCustomer } from "@lib/data/customer";
import { getBaseURL } from "@lib/util/env";
import { StoreCartShippingOption } from "@medusajs/types";
import CartMismatchBanner from "@modules/layout/components/cart-mismatch-banner";
import Footer from "@modules/layout/templates/footer";
import Nav from "@modules/layout/templates/nav";
import FreeShippingPriceNudge from "@modules/shipping/components/free-shipping-price-nudge";
import DiscountPopup from "@modules/common/components/discount-popup";

export const metadata: Metadata = {
    metadataBase: new URL(getBaseURL()),
};

export default async function PageLayout(props: { children: React.ReactNode }) {
    const customer = await retrieveCustomer();
    const cart = await retrieveCart();
    let shippingOptions: StoreCartShippingOption[] = [];

    if (cart) {
        const { shipping_options } = await listCartOptions();

        shippingOptions = shipping_options;
    }

    return (
        <>
            <Nav />
            {customer && cart && <CartMismatchBanner customer={customer} cart={cart} />}

            {cart && (
                <FreeShippingPriceNudge
                    variant="popup"
                    cart={cart}
                    shippingOptions={shippingOptions}
                />
            )}
            {!customer && <DiscountPopup />}
            {props.children}
            <Footer />
        </>
    );
}
```

### `apps/storefront/src/modules/account/templates/login-template.tsx`

**Vai trò:** Mở register trước sign-in.

```tsx
"use client";

import { useState } from "react";

import Register from "@modules/account/components/register";
import Login from "@modules/account/components/login";

export enum LOGIN_VIEW {
    SIGN_IN = "sign-in",
    REGISTER = "register",
}

const LoginTemplate = () => {
    const [currentView, setCurrentView] = useState("register");

    return (
        <div className="w-full flex justify-start px-8 py-8">
            {currentView === "sign-in" ? (
                <Login setCurrentView={setCurrentView} />
            ) : (
                <Register setCurrentView={setCurrentView} />
            )}
        </div>
    );
};

export default LoginTemplate;
```

## UI test

1. Seed tier: `pnpm run seed:customer-tiers`.
2. Login Ngoc (Silver) hoặc Son (Gold), cập nhật cart và xem tier code được apply.
3. Đăng ký customer mới trong incognito; FIRST_PURCHASE tự được add.
4. Hoàn tất một order, tạo cart mới và thử add FIRST_PURCHASE để thấy validation lỗi.
