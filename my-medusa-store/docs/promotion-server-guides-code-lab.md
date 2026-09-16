# Promotion Module Server Guides — Code Lab tự gõ lại

Tài liệu này hướng dẫn bạn tự code lại hai server guide của Promotion Module trong source hiện tại:

1. Customer Tiers.
2. First-Purchase Discounts.

Mục tiêu không phải copy hết code một lần. Hãy gõ theo thứ tự dưới đây, chạy/quan sát từng bước, rồi mới đi tiếp.

## Bức tranh chung

```text
Customer Tier

Admin tạo Tier + Rule + Promotion
  -> order.placed
  -> tính tổng chi tiêu customer
  -> Customer <-> Tier link
  -> cart.updated
  -> tự apply promotion của tier

First Purchase

cart.created / cart.customer_transferred
  -> kiểm tra customer chưa có order
  -> tự apply FIRST_PURCHASE
  -> validate lại khi thêm promotion và checkout
```

Hai feature đều dùng Promotion Module, nhưng dữ liệu business khác nhau:

| Feature        | Nguồn điều kiện                           | Promotion được chọn như thế nào |
| -------------- | ----------------------------------------- | ------------------------------- |
| Customer Tier  | `TierRule`: ngưỡng chi tiêu theo currency | Tier hiện tại có `promo_id`     |
| First Purchase | Customer có account và chưa có order      | Mã cố định `FIRST_PURCHASE`     |

## Phần A — Customer Tiers

### A1. Tạo module dữ liệu

Gõ theo thứ tự:

1. `apps/backend/src/modules/tier/models/tier.ts`
2. `apps/backend/src/modules/tier/models/tier-rule.ts`
3. `apps/backend/src/modules/tier/service.ts`
4. `apps/backend/src/modules/tier/index.ts`
5. Thêm `./src/modules/tier` vào `modules` trong `medusa-config.ts`.
6. Chạy `pnpm exec medusa db:generate tier`, sau đó `pnpm exec medusa db:migrate`.

`Tier` là bảng hạng: `name`, `promo_id`. `TierRule` là bảng điều kiện: `min_purchase_value`, `currency_code`, `tier_id`.

```ts
export const Tier = model.define("tier", {
    id: model.id().primaryKey(),
    name: model.text(),
    promo_id: model.text().nullable(),
    tier_rules: model.hasMany(() => TierRule, { mappedBy: "tier" }),
});
```

Index unique `tier_id + currency_code` nghĩa là mỗi tier chỉ có một rule cho một currency.

### A2. Liên kết với Customer và Promotion

Tạo:

- `src/links/tier-customer.ts`
- `src/links/tier-promotion.ts`

Customer không có cột `tier_id`. Medusa lưu quan hệ bằng Module Link:

```text
Customer A <-> Tier Silver
Tier Silver --promo_id--> Promotion TIER_TEST_SILVER
```

`tier-customer.ts` dùng `isList: true` ở phía Customer để một Tier có nhiều customer. `tier-promotion.ts` là read-only link: nó đọc Promotion từ `Tier.promo_id`, không tự tạo record link khác.

### A3. Tạo/sửa Tier từ Admin

Luồng tạo tier:

```text
POST /admin/tiers
  -> createTierWorkflow
  -> Query Graph xác minh promo_id (nếu có)
  -> createTierStep
  -> createTierRulesStep
  -> Query Graph trả tier + tier_rules
```

Các file backend:

| File                                   | Hàm chính             | Vai trò                                              |
| -------------------------------------- | --------------------- | ---------------------------------------------------- |
| `workflows/steps/create-tier.ts`       | `createTierStep`      | Tạo Tier, compensation sẽ xóa tier nếu workflow lỗi. |
| `workflows/steps/create-tier-rules.ts` | `createTierRulesStep` | Tạo rules, compensation sẽ xóa rules đã tạo.         |
| `workflows/create-tier.ts`             | `createTierWorkflow`  | Ghép validation, steps và response.                  |
| `api/admin/tiers/route.ts`             | `POST`, `GET`         | API tạo/list tier.                                   |
| `api/admin/tiers/[id]/route.ts`        | `GET`, `POST`         | API detail/update tier.                              |
| `api/middlewares.ts`                   | schemas/query config  | Validate request body và fields/pagination.          |

Sau backend, gõ UI theo dependency:

1. `src/admin/lib/sdk.ts`
2. `src/admin/routes/tiers/page.tsx`
3. `src/admin/components/create-tier-modal.tsx`
4. `src/admin/routes/tiers/[id]/page.tsx`
5. Các component detail/rules/customers/edit drawer.

### A4. Tính tier khi order được đặt

File call chain:

```text
src/subscribers/order-placed.ts
  -> updateCustomerTierOnOrderWorkflow({ order_id })
  -> validateCustomerStep
  -> Query order history cùng currency
  -> determineTierStep
  -> TierModuleService.calculateQualifyingTier
  -> dismiss/create Customer-Tier link
```

`calculateQualifyingTier(currencyCode, purchaseValue)` lấy tất cả rule cùng currency, sort giảm dần theo ngưỡng, rồi chọn rule đầu tiên có `purchaseValue >= min_purchase_value`.

Ví dụ rule VND: Bronze `0`, Silver `2.000.000`, Gold `10.000.000`. Customer chi `3.500.000` sẽ nhận Silver.

Chỉ cộng order không phải `DRAFT`/`CANCELED`, và chỉ cùng currency với order vừa đặt. Đây là lý do workflow không tính cross-currency một cách sai lệch.

### A5. Tự apply tier promotion vào cart

```text
cart.updated
  -> cartUpdatedHandler
  -> addTierPromotionToCartWorkflow
  -> lock cart
  -> đọc customer.tier.promotion
  -> validateTierPromotionStep
  -> updateCartPromotionsWorkflow.runAsStep(ADD)
  -> release lock
```

`validateTierPromotionStep` trả `promotion_code: null` nếu customer là guest, chưa đăng ký, tier không có promotion, hoặc promotion inactive. Workflow chỉ add khi code hợp lệ và cart chưa có code đó.

### A6. API/Storefront tiến độ tier

`GET /store/customers/me/next-tier?region_id=...`:

1. Lấy customer và `customer.tier`.
2. Lấy order hợp lệ theo region.
3. Tính tổng purchase value.
4. `calculateNextTierUpgrade` tìm rule thấp nhất lớn hơn tổng hiện tại.
5. Trả current tier, current purchase value, next tier và số tiền còn thiếu.

Storefront dùng `retrieveCustomerNextTier` trong `lib/data/customer.ts`, sau đó render `modules/common/customer-tier/index.tsx` ở Account và Order Confirmation.

## Phần B — First-Purchase Discounts

### B1. Promotion và constant

Tạo promotion active trong Admin với code `FIRST_PURCHASE`, hoặc chạy:

```bash
cd apps/backend
pnpm run setup:promotions
```

Trong `src/constants.ts`:

```ts
export const FIRST_PURCHASE_PROMOTION_CODE = "FIRST_PURCHASE";
```

Đừng hard-code mã này trong workflow/hook. Constant giúp đổi mã ở một nơi.

### B2. Tự apply promotion

Files:

| File                                      | Hàm                               | Vai trò                                                            |
| ----------------------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| `workflows/apply-first-purchase-promo.ts` | `applyFirstPurchasePromoWorkflow` | Query cart/customer/orders/promotion và add mã nếu hợp lệ.         |
| `subscribers/apply-first-purchase.ts`     | `cartCreatedHandler`              | Chạy workflow khi `cart.created` hoặc `cart.customer_transferred`. |

Điều kiện add:

```text
promotion tồn tại
AND cart chưa có promotion đó
AND cart có customer
AND customer.orders.length === 0
```

Event `cart.customer_transferred` là bắt buộc: cart thường được tạo lúc guest; sau login/register cart mới có customer để xét đơn đầu tiên.

### B3. Gộp validation với Customer Tier

Medusa chỉ cho phép **một handler cho một hook**. Vì project có hai feature, chỉ đăng ký ở:

`src/workflows/hooks/validate-promotion.ts`

File này có đúng hai registrations:

```ts
updateCartPromotionsWorkflow.hooks.validate(...)
completeCartWorkflow.hooks.validate(...)
```

Trong mỗi handler, gõ hai khối logic:

1. First-purchase: nếu có `FIRST_PURCHASE`, customer phải có account và chưa có order.
2. Tier: nếu promotion đang add/applied thuộc một Tier, `customer.tier.id` phải đúng với tier sở hữu promotion.

Không tạo thêm các file khác cũng gọi `.hooks.validate(...)`; server sẽ lỗi `Cannot define multiple hook handlers for the validate hook`.

### B4. Storefront popup

| File                                                 | Vai trò                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `modules/common/components/discount-popup/index.tsx` | Client popup, lưu `discount_popup_shown` trong localStorage. |
| `app/[countryCode]/(main)/layout.tsx`                | Chỉ render popup khi chưa có customer.                       |
| `modules/account/templates/login-template.tsx`       | Default view là `register`, không phải `sign-in`.            |

Popup chỉ marketing UX; backend workflow/hook mới là nơi enforce rule và bảo mật.

## Checklist tự code

1. Code Tier Module + migration trước.
2. Code links trước workflow đọc `customer.tier`.
3. Code Admin API trước Admin UI.
4. Code `order.placed` trước `cart.updated` để tier có thể được gán tự động sau order.
5. Code first-purchase workflow/subscriber.
6. Cuối cùng gộp mọi validate vào `validate-promotion.ts`.
7. Test bằng seed: Cong = Bronze, Ngoc = Silver, Son = Gold; password `supersecret`.

## UI test nhanh

- **Tier promotion:** đăng nhập Ngoc hoặc Son, thêm/cập nhật cart, kiểm tra `TIER_TEST_SILVER`/`TIER_TEST_GOLD` xuất hiện.
- **First purchase:** mở incognito, đăng ký customer mới, thêm sản phẩm, kiểm tra `FIRST_PURCHASE` tự xuất hiện; hoàn tất order, tạo cart mới và xác nhận mã không còn tự thêm.
- **Unauthorized tier code:** customer Silver thử thêm Gold code; API phải trả `INVALID_DATA`.

## Source copy: `apps/backend/src/constants.ts`

```ts
export const LOYALTY_PROMOTION_PREFIX = "LOYALTY";
export const LOYALTY_EARN_SPEND = 10_000;
export const LOYALTY_REDEMPTION_POINTS = 100;
export const LOYALTY_REDEMPTION_VALUE = 10_000;
export const FIRST_PURCHASE_PROMOTION_CODE = "FIRST_PURCHASE";
```

## Source copy: `apps/backend/src/modules/tier/models/tier.ts`

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

## Source copy: `apps/backend/src/modules/tier/models/tier-rule.ts`

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

## Source copy: `apps/backend/src/modules/tier/service.ts`

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

## Source copy: `apps/backend/src/modules/tier/index.ts`

```ts
import TierModuleService from "./service";
import { Module } from "@medusajs/framework/utils";

export const TIER_MODULE = "tier";

export default Module(TIER_MODULE, {
    service: TierModuleService,
});
```

## Source copy: `apps/backend/src/links/tier-customer.ts`

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

## Source copy: `apps/backend/src/links/tier-promotion.ts`

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

## Source copy: `apps/backend/src/workflows/steps/create-tier.ts`

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

## Source copy: `apps/backend/src/workflows/steps/create-tier-rules.ts`

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

## Source copy: `apps/backend/src/workflows/steps/validate-customer.ts`

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

## Source copy: `apps/backend/src/workflows/steps/determine-tier.ts`

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

## Source copy: `apps/backend/src/workflows/steps/validate-tier-promotion.ts`

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

## Source copy: `apps/backend/src/workflows/create-tier.ts`

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

## Source copy: `apps/backend/src/workflows/update-customer-tier-on-order.ts`

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

## Source copy: `apps/backend/src/workflows/add-tier-promotion-to-cart.ts`

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

## Source copy: `../apps/backend/src/subscribers/order-placed.ts`

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

## Source copy: `apps/backend/src/subscribers/cart-updated.ts`

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

## Source copy: `apps/backend/src/api/admin/tiers/route.ts`

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

## Source copy: `apps/backend/src/api/store/customers/me/next-tier/route.ts`

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

## Source copy: `apps/backend/src/workflows/apply-first-purchase-promo.ts`

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

## Source copy: `apps/backend/src/subscribers/apply-first-purchase.ts`

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

## Source copy: `apps/backend/src/workflows/hooks/validate-promotion.ts`

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

## Source copy: `apps/storefront/src/modules/common/customer-tier/index.tsx`

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

## Source copy: `apps/storefront/src/modules/common/components/discount-popup/index.tsx`

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

## Source copy: `apps/backend/src/api/admin/tiers/[id]/route.ts`

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

## Source copy: `apps/backend/src/api/admin/tiers/[id]/customers/route.ts`

```ts
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const { id } = req.params;

    // Query customers linked to this tier
    const { data: customers, metadata } = await query.index({
        entity: "customer",
        filters: {
            tier: {
                id,
            },
        },
        ...req.queryConfig,
    });

    res.json({
        customers,
        count: metadata?.estimate_count || 0,
        offset: metadata?.skip || 0,
        limit: metadata?.take || 15,
    });
}
```

## Source copy: `apps/backend/src/api/middlewares.ts`

```ts
import {
    defineMiddlewares,
    validateAndTransformBody,
    validateAndTransformQuery,
} from "@medusajs/framework/http";
import { createFindParams } from "@medusajs/medusa/api/utils/validators";
import { CreateTierSchema } from "./admin/tiers/route";
import { UpdateTierSchema } from "./admin/tiers/[id]/route";
import { NextTierSchema } from "./store/customers/me/next-tier/route";

export default defineMiddlewares({
    routes: [
        // GET /admin/tiers - List tiers
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
        // POST /admin/tiers - Create tier
        {
            matcher: "/admin/tiers",
            methods: ["POST"],
            middlewares: [validateAndTransformBody(CreateTierSchema)],
        },
        // GET /admin/tiers/:id - Get tier
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
        // POST /admin/tiers/:id - Update tier
        {
            matcher: "/admin/tiers/:id",
            methods: ["POST"],
            middlewares: [validateAndTransformBody(UpdateTierSchema)],
        },
        // GET /admin/tiers/:id/customers - List customers in tier
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
        {
            matcher: "/store/customers/me/next-tier",
            methods: ["GET"],
            middlewares: [validateAndTransformQuery(NextTierSchema, {})],
        },
        {
            matcher: "/admin/customers*",
            methods: ["GET"],
            middlewares: [
                (req, res, next) => {
                    (req.allowed ??= []).push("tier");
                    next();
                },
            ],
        },
    ],
});
```

## Source copy: `apps/backend/src/admin/lib/sdk.ts`

```ts
import Medusa from "@medusajs/js-sdk";

export const sdk = new Medusa({
    baseUrl: import.meta.env.VITE_MEDUSA_BACKEND_URL || "/",
    debug: import.meta.env.DEV,
    auth: {
        type: "session",
    },
});
```

## Source copy: `apps/backend/src/admin/routes/tiers/page.tsx`

```tsx
import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
    Container,
    Heading,
    Button,
    DataTable,
    createDataTableColumnHelper,
    useDataTable,
    DataTablePaginationState,
} from "@medusajs/ui";
import { useNavigate, Link } from "react-router-dom";
import { UserGroup } from "@medusajs/icons";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { sdk } from "../../lib/sdk";
import { CreateTierModal } from "../../components/create-tier-modal";

export type Tier = {
    id: string;
    name: string;
    promotion: {
        id: string;
        code: string;
    } | null;
    tier_rules: Array<{
        id: string;
        min_purchase_value: number;
        currency_code: string;
    }>;
};

type TiersResponse = {
    tiers: Tier[];
    count: number;
    offset: number;
    limit: number;
};

const columnHelper = createDataTableColumnHelper<Tier>();

const columns = [
    columnHelper.accessor("name", {
        header: "Name",
        enableSorting: true,
    }),
    columnHelper.accessor("promotion", {
        header: "Promotion",
        cell: ({ getValue }) => {
            const promotion = getValue();
            return promotion ? (
                <Link to={`/promotions/${promotion.id}`}>{promotion.code}</Link>
            ) : (
                "-"
            );
        },
    }),
];

const TiersPage = () => {
    const navigate = useNavigate();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const limit = 15;
    const [pagination, setPagination] = useState<DataTablePaginationState>({
        pageSize: limit,
        pageIndex: 0,
    });

    const offset = useMemo(() => {
        return pagination.pageIndex * limit;
    }, [pagination]);

    const { data, isLoading } = useQuery({
        queryFn: () =>
            sdk.client.fetch<TiersResponse>("/admin/tiers", {
                method: "GET",
                query: {
                    limit,
                    offset,
                },
            }),
        queryKey: ["tiers", "list", limit, offset],
    });

    const tiers = data?.tiers || [];

    const table = useDataTable({
        columns,
        data: tiers,
        getRowId: (tier) => tier.id,
        rowCount: data?.count || 0,
        isLoading,
        pagination: {
            state: pagination,
            onPaginationChange: setPagination,
        },
        onRowClick: (_event, row) => {
            navigate(`/tiers/${row.id}`);
        },
    });

    return (
        <Container className="divide-y p-0">
            <DataTable instance={table}>
                <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
                    <Heading level="h1">Customer Tiers</Heading>
                    <Button onClick={() => setIsCreateModalOpen(true)}>Create Tier</Button>
                </DataTable.Toolbar>
                <DataTable.Table />
                <DataTable.Pagination />
            </DataTable>
            <CreateTierModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} />
        </Container>
    );
};

export const config = defineRouteConfig({
    label: "Customer Tiers",
    icon: UserGroup,
});

export default TiersPage;
```

## Source copy: `apps/backend/src/admin/routes/tiers/[id]/page.tsx`

```tsx
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "../../../lib/sdk";
import { Tier } from "../page";
import { TierDetailsSection } from "../../../components/tier-details-section";
import { TierRulesTable } from "../../../components/tier-rules-table";
import { TierCustomersTable } from "../../../components/tier-customers-table";

type TierResponse = {
    tier: Tier;
};

const TierDetailsPage = () => {
    const { id } = useParams();

    const { data: tierData } = useQuery({
        queryFn: () =>
            sdk.client.fetch<TierResponse>(`/admin/tiers/${id}`, {
                method: "GET",
            }),
        queryKey: ["tier", id],
        enabled: !!id,
    });

    const tier = tierData?.tier;

    return (
        <>
            <TierDetailsSection tier={tier} />
            <TierRulesTable tierRules={tier?.tier_rules} />
            {tier?.id && <TierCustomersTable tierId={tier.id} />}
        </>
    );
};

export const config = defineRouteConfig({
    label: "Tier Details",
});

export default TierDetailsPage;
```

## Source copy: `apps/backend/src/admin/components/create-tier-modal.tsx`

```tsx
import { FocusModal, Heading, Label, Input, Button, Select, IconButton, toast } from "@medusajs/ui";
import { Trash } from "@medusajs/icons";
import { useForm, Controller, FormProvider } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sdk } from "../lib/sdk";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tier } from "../routes/tiers/page";

type CreateTierFormData = {
    name: string;
    promo_id: string | null;
    tier_rules: Array<{
        min_purchase_value: number;
        currency_code: string;
    }>;
};

type CreateTierModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export const CreateTierModal = ({ open, onOpenChange }: CreateTierModalProps) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [tierRules, setTierRules] = useState<
        {
            currency_code: string;
            min_purchase_value: number;
        }[]
    >([]);

    const form = useForm<CreateTierFormData>({
        defaultValues: {
            name: "",
            promo_id: null,
            tier_rules: [],
        },
    });

    const { data: promotionsData } = useQuery({
        queryFn: () => sdk.admin.promotion.list(),
        queryKey: ["promotions", "list"],
    });

    const { data: storeData } = useQuery({
        queryFn: () =>
            sdk.admin.store.list({
                fields: "id,supported_currencies.*,supported_currencies.currency.*",
            }),
        queryKey: ["store"],
    });

    const createTierMutation = useMutation({
        mutationFn: async (data: CreateTierFormData) => {
            return await sdk.client.fetch<{ tier: Tier }>("/admin/tiers", {
                method: "POST",
                body: data,
            });
        },
        onSuccess: (data: { tier: Tier }) => {
            queryClient.invalidateQueries({ queryKey: ["tiers"] });
            form.reset();
            setTierRules([]);
            onOpenChange(false);
            navigate(`/tiers/${data.tier.id}`);
            toast.success("Success", {
                description: "Tier created successfully",
                position: "top-right",
            });
        },
        onError: (error) => {
            toast.error("Error", {
                description: error.message,
                position: "top-right",
            });
        },
    });

    const handleSubmit = form.handleSubmit((data) => {
        createTierMutation.mutate({
            ...data,
            tier_rules: tierRules,
        });
    });

    const promotions = promotionsData?.promotions || [];
    const store = storeData?.stores?.[0];
    const supportedCurrencies = store?.supported_currencies || [];

    const getAvailableCurrencies = () => {
        const usedCurrencies = new Set(tierRules.map((rule) => rule.currency_code));
        return supportedCurrencies.filter((sc) => !usedCurrencies.has(sc.currency_code));
    };

    const addTierRule = () => {
        const availableCurrencies = getAvailableCurrencies();
        if (availableCurrencies.length > 0) {
            const firstCurrency = availableCurrencies[0].currency_code;
            setTierRules([
                ...tierRules,
                {
                    currency_code: firstCurrency,
                    min_purchase_value: 0,
                },
            ]);
        }
    };

    const removeTierRule = (index: number) => {
        setTierRules(tierRules.filter((_, i) => i !== index));
    };

    const updateTierRule = (
        index: number,
        field: "currency_code" | "min_purchase_value",
        value: string | number,
    ) => {
        const updated = [...tierRules];
        updated[index] = {
            ...updated[index],
            [field]: value,
        };
        setTierRules(updated);
    };

    return (
        <FocusModal open={open} onOpenChange={onOpenChange}>
            <FocusModal.Content>
                <FormProvider {...form}>
                    <form onSubmit={handleSubmit} className="flex h-full flex-col overflow-hidden">
                        <FocusModal.Header>
                            <div className="flex items-center justify-between">
                                <Heading level="h1">Create Tier</Heading>
                            </div>
                        </FocusModal.Header>
                        <FocusModal.Body className="flex flex-1 flex-col overflow-y-auto">
                            <div className="mx-auto flex w-full max-w-[720px] flex-col gap-y-8 px-2 py-16">
                                <div className="flex flex-col gap-y-4">
                                    <Controller
                                        control={form.control}
                                        name="name"
                                        rules={{ required: "Name is required" }}
                                        render={({ field }) => (
                                            <div className="flex flex-col gap-y-2">
                                                <Label size="small" weight="plus">
                                                    Name
                                                </Label>
                                                <Input
                                                    {...field}
                                                    placeholder="e.g., Bronze, Silver, Gold"
                                                />
                                            </div>
                                        )}
                                    />

                                    <Controller
                                        control={form.control}
                                        name="promo_id"
                                        render={({ field }) => (
                                            <div className="flex flex-col gap-y-2">
                                                <Label size="small" weight="plus">
                                                    Promotion (Optional)
                                                </Label>
                                                <Select
                                                    value={field.value || ""}
                                                    onValueChange={(value) =>
                                                        field.onChange(value || null)
                                                    }
                                                >
                                                    <Select.Trigger>
                                                        <Select.Value placeholder="Select a promotion" />
                                                    </Select.Trigger>
                                                    <Select.Content>
                                                        {promotions.map((promo) => (
                                                            <Select.Item
                                                                key={promo.id}
                                                                value={promo.id}
                                                            >
                                                                {promo.code}
                                                            </Select.Item>
                                                        ))}
                                                    </Select.Content>
                                                </Select>
                                            </div>
                                        )}
                                    />

                                    <div className="flex flex-col gap-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label size="small" weight="plus">
                                                Tier Rules
                                            </Label>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="small"
                                                onClick={addTierRule}
                                                disabled={getAvailableCurrencies().length === 0}
                                            >
                                                Add Rule
                                            </Button>
                                        </div>

                                        {tierRules.length === 0 && (
                                            <div className="text-sm text-gray-500">
                                                No tier rules added. Click "Add Rule" to add a rule
                                                for a currency.
                                            </div>
                                        )}

                                        {tierRules.map((rule, index) => (
                                            <div
                                                key={index}
                                                className="flex items-end gap-x-2 rounded-lg border p-4"
                                            >
                                                <div className="flex flex-1 flex-col gap-y-2">
                                                    <Label size="small">Currency</Label>
                                                    <Select
                                                        value={rule.currency_code}
                                                        onValueChange={(value) =>
                                                            updateTierRule(
                                                                index,
                                                                "currency_code",
                                                                value,
                                                            )
                                                        }
                                                    >
                                                        <Select.Trigger>
                                                            <Select.Value placeholder="Select currency" />
                                                        </Select.Trigger>
                                                        <Select.Content>
                                                            {supportedCurrencies
                                                                .filter((sc) => {
                                                                    // Allow current selection or currencies not used in other rules
                                                                    return (
                                                                        sc.currency_code ===
                                                                            rule.currency_code ||
                                                                        !tierRules.some(
                                                                            (r, i) =>
                                                                                i !== index &&
                                                                                r.currency_code ===
                                                                                    sc.currency_code,
                                                                        )
                                                                    );
                                                                })
                                                                .map((sc) => (
                                                                    <Select.Item
                                                                        key={sc.currency_code}
                                                                        value={sc.currency_code}
                                                                    >
                                                                        {sc.currency.code.toUpperCase()}{" "}
                                                                        - {sc.currency.name}
                                                                    </Select.Item>
                                                                ))}
                                                        </Select.Content>
                                                    </Select>
                                                </div>
                                                <div className="flex flex-1 flex-col gap-y-2">
                                                    <Label size="small">
                                                        Minimum Purchase Value
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={rule.min_purchase_value}
                                                        onChange={(e) =>
                                                            updateTierRule(
                                                                index,
                                                                "min_purchase_value",
                                                                parseFloat(e.target.value) || 0,
                                                            )
                                                        }
                                                    />
                                                </div>
                                                <IconButton
                                                    type="button"
                                                    variant="transparent"
                                                    size="small"
                                                    onClick={() => removeTierRule(index)}
                                                >
                                                    <Trash />
                                                </IconButton>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </FocusModal.Body>
                        <FocusModal.Footer>
                            <div className="flex items-center gap-x-2">
                                <FocusModal.Close asChild>
                                    <Button variant="secondary" size="small">
                                        Cancel
                                    </Button>
                                </FocusModal.Close>
                                <Button
                                    type="submit"
                                    size="small"
                                    isLoading={createTierMutation.isPending}
                                >
                                    Create
                                </Button>
                            </div>
                        </FocusModal.Footer>
                    </form>
                </FormProvider>
            </FocusModal.Content>
        </FocusModal>
    );
};
```

## Source copy: `apps/backend/src/admin/components/edit-tier-drawer.tsx`

```tsx
import { Drawer, Heading, Label, Input, Button, Select, IconButton, toast } from "@medusajs/ui";
import { useForm, Controller, FormProvider } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sdk } from "../lib/sdk";
import { useState, useEffect } from "react";
import { Tier } from "../routes/tiers/page";
import { Trash } from "@medusajs/icons";

type EditTierFormData = {
    name: string;
    promo_id: string | null;
    tier_rules: Array<{
        min_purchase_value: number;
        currency_code: string;
    }>;
};

type EditTierDrawerProps = {
    tier: Tier | undefined;
};

export const EditTierDrawer = ({ tier }: EditTierDrawerProps) => {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [tierRules, setTierRules] = useState<
        {
            currency_code: string;
            min_purchase_value: number;
        }[]
    >([]);

    const form = useForm<EditTierFormData>({
        defaultValues: {
            name: "",
            promo_id: null,
            tier_rules: [],
        },
    });

    const { data: promotionsData } = useQuery({
        queryFn: () => sdk.admin.promotion.list(),
        queryKey: ["promotions", "list"],
        enabled: open,
    });

    const { data: storeData } = useQuery({
        queryFn: () =>
            sdk.admin.store.list({
                fields: "id,supported_currencies.*,supported_currencies.currency.*",
            }),
        queryKey: ["store"],
        enabled: open,
    });

    const updateTierMutation = useMutation({
        mutationFn: async (data: EditTierFormData) => {
            if (!tier) return;
            return await sdk.client.fetch(`/admin/tiers/${tier.id}`, {
                method: "POST",
                body: data,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tier", tier?.id] });
            queryClient.invalidateQueries({ queryKey: ["tiers"] });
            setOpen(false);
            toast.success("Success", {
                description: "Tier updated successfully",
                position: "top-right",
            });
        },
        onError: (error) => {
            toast.error("Error", {
                description: error.message,
                position: "top-right",
            });
        },
    });

    // Initialize form when tier data is available
    useEffect(() => {
        if (tier && open) {
            form.reset({
                name: tier.name,
                promo_id: tier.promotion?.id || null,
                tier_rules: tier.tier_rules || [],
            });
            setTierRules(
                tier.tier_rules?.map((rule) => ({
                    currency_code: rule.currency_code,
                    min_purchase_value: rule.min_purchase_value,
                })) || [],
            );
        }
    }, [tier, open, form]);

    const handleSubmit = form.handleSubmit((data) => {
        updateTierMutation.mutate({
            ...data,
            tier_rules: tierRules,
        });
    });

    const promotions = promotionsData?.promotions || [];
    const store = storeData?.stores?.[0];
    const supportedCurrencies = store?.supported_currencies || [];

    const getAvailableCurrencies = () => {
        const usedCurrencies = new Set(tierRules.map((rule) => rule.currency_code));
        return supportedCurrencies.filter((sc) => !usedCurrencies.has(sc.currency_code));
    };

    const addTierRule = () => {
        const availableCurrencies = getAvailableCurrencies();
        if (availableCurrencies.length > 0) {
            const firstCurrency = availableCurrencies[0].currency_code;
            setTierRules([
                ...tierRules,
                {
                    currency_code: firstCurrency,
                    min_purchase_value: 0,
                },
            ]);
        }
    };

    const removeTierRule = (index: number) => {
        setTierRules(tierRules.filter((_, i) => i !== index));
    };

    const updateTierRule = (
        index: number,
        field: "currency_code" | "min_purchase_value",
        value: string | number,
    ) => {
        const updated = [...tierRules];
        updated[index] = {
            ...updated[index],
            [field]: value,
        };
        setTierRules(updated);
    };

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <Drawer.Trigger asChild>
                <Button variant="secondary" size="small">
                    Edit
                </Button>
            </Drawer.Trigger>
            <Drawer.Content>
                <FormProvider {...form}>
                    <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
                        <Drawer.Header>
                            <Heading level="h1">Edit Tier</Heading>
                        </Drawer.Header>
                        <Drawer.Body className="flex max-w-full flex-1 flex-col gap-y-8 overflow-y-auto">
                            <Controller
                                control={form.control}
                                name="name"
                                rules={{ required: "Name is required" }}
                                render={({ field }) => (
                                    <div className="flex flex-col space-y-2">
                                        <Label size="small" weight="plus">
                                            Name
                                        </Label>
                                        <Input
                                            {...field}
                                            placeholder="e.g., Bronze, Silver, Gold"
                                        />
                                    </div>
                                )}
                            />

                            <Controller
                                control={form.control}
                                name="promo_id"
                                render={({ field }) => (
                                    <div className="flex flex-col space-y-2">
                                        <Label size="small" weight="plus">
                                            Promotion (Optional)
                                        </Label>
                                        <Select
                                            value={field.value || ""}
                                            onValueChange={(value) => field.onChange(value || null)}
                                        >
                                            <Select.Trigger>
                                                <Select.Value placeholder="Select a promotion" />
                                            </Select.Trigger>
                                            <Select.Content>
                                                {promotions.map((promo) => (
                                                    <Select.Item key={promo.id} value={promo.id}>
                                                        {promo.code}
                                                    </Select.Item>
                                                ))}
                                            </Select.Content>
                                        </Select>
                                    </div>
                                )}
                            />

                            <div className="flex flex-col gap-y-4">
                                <div className="flex items-center justify-between">
                                    <Label size="small" weight="plus">
                                        Tier Rules
                                    </Label>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="small"
                                        onClick={addTierRule}
                                        disabled={getAvailableCurrencies().length === 0}
                                    >
                                        Add Rule
                                    </Button>
                                </div>

                                {tierRules.length === 0 && (
                                    <div className="text-sm text-gray-500">
                                        No tier rules added. Click "Add Rule" to add a rule for a
                                        currency.
                                    </div>
                                )}

                                {tierRules.map((rule, index) => (
                                    <div
                                        key={index}
                                        className="flex items-end gap-x-2 rounded-lg border p-4"
                                    >
                                        <div className="flex flex-1 flex-col gap-y-2">
                                            <Label size="small">Currency</Label>
                                            <Select
                                                value={rule.currency_code}
                                                onValueChange={(value) =>
                                                    updateTierRule(index, "currency_code", value)
                                                }
                                            >
                                                <Select.Trigger>
                                                    <Select.Value />
                                                </Select.Trigger>
                                                <Select.Content>
                                                    {supportedCurrencies
                                                        .filter((sc) => {
                                                            return (
                                                                sc.currency_code ===
                                                                    rule.currency_code ||
                                                                !tierRules.some(
                                                                    (r, i) =>
                                                                        i !== index &&
                                                                        r.currency_code ===
                                                                            sc.currency_code,
                                                                )
                                                            );
                                                        })
                                                        .map((sc) => (
                                                            <Select.Item
                                                                key={sc.currency_code}
                                                                value={sc.currency_code}
                                                            >
                                                                {sc.currency.code.toUpperCase()} -{" "}
                                                                {sc.currency.name}
                                                            </Select.Item>
                                                        ))}
                                                </Select.Content>
                                            </Select>
                                        </div>
                                        <div className="flex flex-1 flex-col gap-y-2">
                                            <Label size="small">Minimum Purchase Value</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={rule.min_purchase_value}
                                                onChange={(e) =>
                                                    updateTierRule(
                                                        index,
                                                        "min_purchase_value",
                                                        parseFloat(e.target.value) || 0,
                                                    )
                                                }
                                            />
                                        </div>
                                        <IconButton
                                            type="button"
                                            variant="transparent"
                                            size="small"
                                            onClick={() => removeTierRule(index)}
                                        >
                                            <Trash />
                                        </IconButton>
                                    </div>
                                ))}
                            </div>
                        </Drawer.Body>
                        <Drawer.Footer>
                            <div className="flex items-center justify-end gap-x-2">
                                <Drawer.Close asChild>
                                    <Button size="small" variant="secondary">
                                        Cancel
                                    </Button>
                                </Drawer.Close>
                                <Button
                                    size="small"
                                    type="submit"
                                    isLoading={updateTierMutation.isPending}
                                >
                                    Save
                                </Button>
                            </div>
                        </Drawer.Footer>
                    </form>
                </FormProvider>
            </Drawer.Content>
        </Drawer>
    );
};
```

## Source copy: `apps/backend/src/admin/components/tier-details-section.tsx`

```tsx
import { Code, Container, Heading, Text } from "@medusajs/ui";
import { Link } from "react-router-dom";
import { Tier } from "../routes/tiers/page";
import { EditTierDrawer } from "./edit-tier-drawer";

type TierDetailsSectionProps = {
    tier: Tier | undefined;
};

export const TierDetailsSection = ({ tier }: TierDetailsSectionProps) => {
    return (
        <Container className="divide-y p-0">
            <div className="flex items-center justify-between px-6 py-4">
                <Heading level="h1">Tier Details</Heading>
                <div className="flex items-center gap-x-2">
                    <EditTierDrawer tier={tier} />
                </div>
            </div>
            <div className="text-ui-fg-subtle grid grid-cols-2 items-center px-6 py-4">
                <Text size="small" weight="plus" leading="compact">
                    Name
                </Text>

                <Text size="small" leading="compact" className="whitespace-pre-line text-pretty">
                    {tier?.name ?? "-"}
                </Text>
            </div>
            <div className="text-ui-fg-subtle grid grid-cols-2 items-center px-6 py-4">
                <Text size="small" weight="plus" leading="compact">
                    Promotion
                </Text>

                {tier?.promotion && (
                    <Link to={`/promotions/${tier.promotion.id}`}>
                        <Code>{tier.promotion.code}</Code>
                    </Link>
                )}
            </div>
        </Container>
    );
};
```

## Source copy: `apps/backend/src/admin/components/tier-rules-table.tsx`

```tsx
import {
    Heading,
    DataTable,
    createDataTableColumnHelper,
    useDataTable,
    Container,
} from "@medusajs/ui";
import { Tier } from "../routes/tiers/page";

type TierRulesTableProps = {
    tierRules: Tier["tier_rules"] | undefined;
};

type TierRule = {
    id: string;
    currency_code: string;
    min_purchase_value: number;
};

const columnHelper = createDataTableColumnHelper<TierRule>();

const columns = [
    columnHelper.accessor("currency_code", {
        header: "Currency",
        cell: ({ getValue }) => getValue().toUpperCase(),
    }),
    columnHelper.accessor("min_purchase_value", {
        header: "Minimum Purchase Value",
    }),
];

export const TierRulesTable = ({ tierRules }: TierRulesTableProps) => {
    const rules = tierRules || [];

    const table = useDataTable({
        columns,
        data: rules,
        getRowId: (rule) => rule.id,
        rowCount: rules.length,
        isLoading: false,
    });

    return (
        <Container className="divide-y p-0">
            <DataTable instance={table}>
                <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
                    <Heading level="h2">Tier Rules</Heading>
                </DataTable.Toolbar>
                <DataTable.Table />
            </DataTable>
        </Container>
    );
};
```

## Source copy: `apps/backend/src/admin/components/tier-customers-table.tsx`

```tsx
import {
    Heading,
    DataTable,
    createDataTableColumnHelper,
    useDataTable,
    Container,
    DataTablePaginationState,
} from "@medusajs/ui";
import { sdk } from "../lib/sdk";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

type TierCustomersTableProps = {
    tierId: string;
};

type Customer = {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
};

type CustomersResponse = {
    customers: Customer[];
    count: number;
    offset: number;
    limit: number;
};

const columnHelper = createDataTableColumnHelper<Customer>();

const columns = [
    columnHelper.accessor("email", {
        header: "Email",
    }),
    columnHelper.accessor("first_name", {
        header: "Name",
        cell: ({ row }) => {
            const customer = row.original;
            return customer.first_name || customer.last_name
                ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim()
                : "-";
        },
    }),
];

export const TierCustomersTable = ({ tierId }: TierCustomersTableProps) => {
    const limit = 15;
    const [pagination, setPagination] = useState<DataTablePaginationState>({
        pageSize: limit,
        pageIndex: 0,
    });

    const offset = useMemo(() => {
        return pagination.pageIndex * limit;
    }, [pagination]);

    const { data: customersData, isLoading: customersLoading } = useQuery({
        queryFn: () =>
            sdk.client.fetch<CustomersResponse>(`/admin/tiers/${tierId}/customers`, {
                method: "GET",
                query: {
                    limit,
                    offset,
                },
            }),
        queryKey: ["tier", tierId, "customers"],
        enabled: !!tierId,
    });
    const table = useDataTable({
        columns,
        data: customersData?.customers || [],
        getRowId: (customer) => customer.id,
        rowCount: customersData?.count || 0,
        isLoading: customersLoading,
        pagination: {
            state: pagination,
            onPaginationChange: setPagination,
        },
    });

    return (
        <Container className="divide-y p-0">
            <DataTable instance={table}>
                <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
                    <Heading level="h2">Customers in this Tier</Heading>
                </DataTable.Toolbar>
                <DataTable.Table />
                <DataTable.Pagination />
            </DataTable>
        </Container>
    );
};
```

## Source copy: `apps/storefront/src/types/tier.ts`

```ts
export type Tier = {
    id: string;
    name: string;
    promotion_id: string;
};

export type CustomerNextTier = {
    current_tier: Tier | null;
    current_purchase_value: number;
    currency_code: string;
    next_tier_upgrade: {
        tier: Tier | null;
        required_amount: number;
        current_purchase_value: number;
        next_tier_min_purchase: number;
    } | null;
};
```

## Source copy: `apps/storefront/src/lib/data/customer.ts`

```ts
"use server";

import { sdk } from "@lib/config";
import medusaError from "@lib/util/medusa-error";
import { HttpTypes } from "@medusajs/types";
import { FetchError } from "@medusajs/js-sdk";
import type { CustomerNextTier } from "types/tier";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
    getAuthHeaders,
    getCacheOptions,
    getCacheTag,
    getCartId,
    getPendingCustomer,
    removeAuthToken,
    removeCartId,
    removePendingCustomer,
    setAuthToken,
    setPendingCustomer,
} from "./cookies";
import { getRegion } from "./regions";

export type CustomerAuthState =
    | { state: "error"; error: string }
    | { state: "verification_required"; email: string }
    | { state: "success" }
    | null;

// Requests a verification email for the given customer. The request must be
// authenticated with a token tied to the auth identity (the token returned by
// register or by a login that requires verification).
async function requestVerificationEmail(email: string, token: string) {
    await sdk.auth.verification.request(
        {
            entity_id: email,
            entity_type: "email",
        },
        {
            authorization: `Bearer ${token}`,
        },
    );
}

export const retrieveCustomer = async (): Promise<HttpTypes.StoreCustomer | null> => {
    const authHeaders = await getAuthHeaders();

    if (!authHeaders) return null;

    const headers = {
        ...authHeaders,
    };

    const next = {
        ...(await getCacheOptions("customers")),
    };

    return await sdk.client
        .fetch<{ customer: HttpTypes.StoreCustomer }>(`/store/customers/me`, {
            method: "GET",
            query: {
                fields: "*orders",
            },
            headers,
            next,
            cache: "force-cache",
        })
        .then(({ customer }) => customer)
        .catch(() => null);
};

export const retrieveCustomerNextTier = async (
    countryCode: string,
): Promise<CustomerNextTier | null> => {
    const authHeaders = await getAuthHeaders();
    const region = await getRegion(countryCode);

    if (!region) return null;
    if (!authHeaders) return null;

    const headers = { ...authHeaders };
    const next = { ...(await getCacheOptions("customers")) };

    return await sdk.client
        .fetch<CustomerNextTier>("/store/customers/me/next-tier", {
            method: "GET",
            headers,
            next,
            query: { region_id: region.id },
        })
        .then((data) => data)
        .catch(() => null);
};

export const updateCustomer = async (body: HttpTypes.StoreUpdateCustomer) => {
    const headers = {
        ...(await getAuthHeaders()),
    };

    const updateRes = await sdk.store.customer
        .update(body, {}, headers)
        .then(({ customer }) => customer)
        .catch(medusaError);

    const cacheTag = await getCacheTag("customers");
    revalidateTag(cacheTag);

    return updateRes;
};

export async function signup(
    _currentState: unknown,
    formData: FormData,
): Promise<CustomerAuthState> {
    const password = formData.get("password") as string;
    const customerForm = {
        email: formData.get("email") as string,
        first_name: formData.get("first_name") as string,
        last_name: formData.get("last_name") as string,
        phone: formData.get("phone") as string,
    };

    try {
        await sdk.auth.register("customer", "emailpass", {
            email: customerForm.email,
            password,
        });
    } catch (error) {
        const fetchError = error as FetchError;
        // An existing identity (for example, an admin user with the same email) is
        // expected and handled: the customer can still log in to link a customer
        // record. Any other error is surfaced.
        if (
            fetchError.statusText !== "Unauthorized" ||
            fetchError.message !== "Identity with email already exists"
        ) {
            return { state: "error", error: String(error) };
        }
    }

    // Persist the extra signup fields. The customer record is created during
    // login, which is deferred until after email verification when the backend
    // requires it.
    await setPendingCustomer(customerForm);

    // Continue by logging in. The login response tells us whether the backend
    // requires email verification — we don't need a storefront-side flag.
    return completeLogin(customerForm.email, password);
}

export async function login(
    _currentState: unknown,
    formData: FormData,
): Promise<CustomerAuthState> {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    return completeLogin(email, password);
}

// Logs the customer in and reconciles the customer record. The behavior is
// driven entirely by the backend's login response, so it works whether or not
// email verification is enabled.
async function completeLogin(email: string, password: string): Promise<CustomerAuthState> {
    let result: Awaited<ReturnType<typeof sdk.auth.login>>;

    try {
        result = await sdk.auth.login("customer", "emailpass", { email, password });
    } catch (error) {
        return { state: "error", error: String(error) };
    }

    // A `location` is returned by third-party auth providers, which this flow
    // doesn't support.
    if (typeof result === "object" && "location" in result) {
        return {
            state: "error",
            error: "This login method isn't supported by the storefront.",
        };
    }

    // The backend requires email verification and the customer hasn't verified
    // yet. Send the verification email and ask them to check their inbox.
    if (
        typeof result === "object" &&
        "verification_required" in result &&
        result.verification_required
    ) {
        try {
            await requestVerificationEmail(email, result.token);
        } catch {
            // Ignore: the customer can resend from the verification page.
        }
        return { state: "verification_required", email };
    }

    if (typeof result !== "string") {
        return {
            state: "error",
            error: "Authentication requires additional steps that aren't supported.",
        };
    }

    let token = result;

    // The token may not be tied to a customer record yet — right after
    // registration, or after verifying a brand-new account. Ask the backend:
    // `/store/customers/me` rejects tokens without a registered actor, so a
    // failed retrieve means we still need to create the customer, then log in
    // again to obtain a customer-bound token.
    const customerExists = await sdk.store.customer
        .retrieve({}, { authorization: `Bearer ${token}` })
        .then(() => true)
        .catch(() => false);

    if (!customerExists) {
        const pending = await getPendingCustomer();

        try {
            await sdk.store.customer.create(
                {
                    email,
                    first_name: pending?.first_name,
                    last_name: pending?.last_name,
                    phone: pending?.phone,
                },
                {},
                { authorization: `Bearer ${token}` },
            );

            token = (await sdk.auth.login("customer", "emailpass", {
                email,
                password,
            })) as string;
        } catch (error) {
            return { state: "error", error: String(error) };
        }

        await removePendingCustomer();
    }

    await setAuthToken(token);

    const customerCacheTag = await getCacheTag("customers");
    revalidateTag(customerCacheTag);

    try {
        await transferCart();
    } catch (error) {
        return { state: "error", error: String(error) };
    }

    return { state: "success" };
}

// Confirms a customer's email using the token from the verification link.
//
// The confirm route doesn't require authentication, so this works even when the
// customer opens the link on a different device than the one they signed up on.
export async function confirmEmailVerification(
    token: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        await sdk.auth.verification.confirm({ code: token });
        return { success: true };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

export async function signout(countryCode: string) {
    await sdk.auth.logout();

    await removeAuthToken();

    const customerCacheTag = await getCacheTag("customers");
    revalidateTag(customerCacheTag);

    await removeCartId();

    const cartCacheTag = await getCacheTag("carts");
    revalidateTag(cartCacheTag);

    redirect(`/${countryCode}/account`);
}

export async function transferCart() {
    const cartId = await getCartId();

    if (!cartId) {
        return;
    }

    const headers = await getAuthHeaders();

    await sdk.store.cart.transferCart(cartId, {}, headers);

    const cartCacheTag = await getCacheTag("carts");
    revalidateTag(cartCacheTag);
}

export const addCustomerAddress = async (
    currentState: Record<string, unknown>,
    formData: FormData,
): Promise<{ success: boolean; error: string | null }> => {
    const isDefaultBilling = (currentState.isDefaultBilling as boolean) || false;
    const isDefaultShipping = (currentState.isDefaultShipping as boolean) || false;

    const address = {
        first_name: formData.get("first_name") as string,
        last_name: formData.get("last_name") as string,
        company: formData.get("company") as string,
        address_1: formData.get("address_1") as string,
        address_2: formData.get("address_2") as string,
        city: formData.get("city") as string,
        postal_code: formData.get("postal_code") as string,
        province: formData.get("province") as string,
        country_code: formData.get("country_code") as string,
        phone: formData.get("phone") as string,
        is_default_billing: isDefaultBilling,
        is_default_shipping: isDefaultShipping,
    };

    const headers = {
        ...(await getAuthHeaders()),
    };

    return sdk.store.customer
        .createAddress(address, {}, headers)
        .then(async () => {
            const customerCacheTag = await getCacheTag("customers");
            revalidateTag(customerCacheTag);
            return { success: true, error: null };
        })
        .catch((err) => {
            return { success: false, error: err.toString() };
        });
};

export const deleteCustomerAddress = async (addressId: string): Promise<void> => {
    const headers = {
        ...(await getAuthHeaders()),
    };

    await sdk.store.customer
        .deleteAddress(addressId, headers)
        .then(async () => {
            const customerCacheTag = await getCacheTag("customers");
            revalidateTag(customerCacheTag);
            return { success: true, error: null };
        })
        .catch((err) => {
            return { success: false, error: err.toString() };
        });
};

export const updateCustomerAddress = async (
    currentState: Record<string, unknown>,
    formData: FormData,
): Promise<{ success: boolean; error: string | null }> => {
    const addressId = (currentState.addressId as string) || (formData.get("addressId") as string);

    if (!addressId) {
        return { success: false, error: "Address ID is required" };
    }

    const address = {
        first_name: formData.get("first_name") as string,
        last_name: formData.get("last_name") as string,
        company: formData.get("company") as string,
        address_1: formData.get("address_1") as string,
        address_2: formData.get("address_2") as string,
        city: formData.get("city") as string,
        postal_code: formData.get("postal_code") as string,
        province: formData.get("province") as string,
        country_code: formData.get("country_code") as string,
    } as HttpTypes.StoreUpdateCustomerAddress;

    const phone = formData.get("phone") as string;

    if (phone) {
        address.phone = phone;
    }

    const headers = {
        ...(await getAuthHeaders()),
    };

    return sdk.store.customer
        .updateAddress(addressId, address, {}, headers)
        .then(async () => {
            const customerCacheTag = await getCacheTag("customers");
            revalidateTag(customerCacheTag);
            return { success: true, error: null };
        })
        .catch((err) => {
            return { success: false, error: err.toString() };
        });
};
```

## Source copy: `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/page.tsx`

```tsx
import { Metadata } from "next";

import Overview from "@modules/account/components/overview";
import { notFound } from "next/navigation";
import { retrieveCustomer, retrieveCustomerNextTier } from "@lib/data/customer";
import { retrieveLoyaltyProfile } from "@lib/data/loyalty";
import { listOrders } from "@lib/data/orders";

export const metadata: Metadata = {
    title: "Account",
    description: "Overview of your account activity.",
};

type Props = {
    params: Promise<{ countryCode: string }>;
};

export default async function OverviewTemplate({ params }: Props) {
    const { countryCode } = await params;
    const customer = await retrieveCustomer().catch(() => null);
    const orders = (await listOrders().catch(() => null)) || null;
    const loyaltyProfile = await retrieveLoyaltyProfile();
    const tierData = await retrieveCustomerNextTier(countryCode);

    if (!customer) {
        notFound();
    }

    return (
        <Overview
            customer={customer}
            orders={orders}
            loyaltyProfile={loyaltyProfile}
            tierData={tierData}
        />
    );
}
```

## Source copy: `apps/storefront/src/modules/account/components/overview/index.tsx`

```tsx
import { Container } from "@modules/common/components/ui";

import ChevronDown from "@modules/common/icons/chevron-down";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { convertToLocale } from "@lib/util/money";
import { HttpTypes } from "@medusajs/types";
import { LoyaltyProfile } from "@lib/data/loyalty";
import CustomerTier from "@modules/common/customer-tier";
import type { CustomerNextTier } from "types/tier";

type OverviewProps = {
    customer: HttpTypes.StoreCustomer | null;
    orders: HttpTypes.StoreOrder[] | null;
    loyaltyProfile: LoyaltyProfile | null;
    tierData: CustomerNextTier | null;
};

const Overview = ({ customer, orders, loyaltyProfile, tierData }: OverviewProps) => {
    return (
        <div data-testid="overview-page-wrapper">
            <div className="hidden small:block">
                <div className="text-xl-semi flex justify-between items-center mb-4">
                    <span data-testid="welcome-message" data-value={customer?.first_name}>
                        Hello {customer?.first_name}
                    </span>
                    <span className="text-small-regular text-ui-fg-base">
                        Signed in as:{" "}
                        <span
                            className="font-semibold"
                            data-testid="customer-email"
                            data-value={customer?.email}
                        >
                            {customer?.email}
                        </span>
                    </span>
                </div>
                <div className="flex flex-col py-8 border-t border-gray-200">
                    <div className="flex flex-col gap-y-4 h-full col-span-1 row-span-2 flex-1">
                        <div className="flex items-start gap-x-16 mb-6">
                            <div className="flex flex-col gap-y-4">
                                <h3 className="text-large-semi">Profile</h3>
                                <div className="flex items-end gap-x-2">
                                    <span
                                        className="text-3xl-semi leading-none"
                                        data-testid="customer-profile-completion"
                                        data-value={getProfileCompletion(customer)}
                                    >
                                        {getProfileCompletion(customer)}%
                                    </span>
                                    <span className="uppercase text-base-regular text-ui-fg-subtle">
                                        Completed
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-y-4">
                                <h3 className="text-large-semi">Addresses</h3>
                                <div className="flex items-end gap-x-2">
                                    <span
                                        className="text-3xl-semi leading-none"
                                        data-testid="addresses-count"
                                        data-value={customer?.addresses?.length || 0}
                                    >
                                        {customer?.addresses?.length || 0}
                                    </span>
                                    <span className="uppercase text-base-regular text-ui-fg-subtle">
                                        Saved
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-y-4">
                                <h3 className="text-large-semi">Membership</h3>
                                <div className="flex items-end gap-x-2">
                                    <span
                                        className="text-3xl-semi leading-none capitalize"
                                        data-testid="customer-tier"
                                    >
                                        {loyaltyProfile?.tier ?? "Bronze"}
                                    </span>
                                    <span
                                        className="uppercase text-base-regular text-ui-fg-subtle"
                                        data-testid="loyalty-points-balance"
                                    >
                                        {loyaltyProfile?.loyalty_points ?? 0} Points
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6">
                            <CustomerTier tierData={tierData} />
                        </div>

                        <div className="flex flex-col gap-y-4">
                            <div className="flex items-center gap-x-2">
                                <h3 className="text-large-semi">Recent orders</h3>
                            </div>
                            <ul className="flex flex-col gap-y-4" data-testid="orders-wrapper">
                                {orders && orders.length > 0 ? (
                                    orders.slice(0, 5).map((order) => {
                                        return (
                                            <li
                                                key={order.id}
                                                data-testid="order-wrapper"
                                                data-value={order.id}
                                            >
                                                <LocalizedClientLink
                                                    href={`/account/orders/details/${order.id}`}
                                                >
                                                    <Container className="bg-gray-50 flex justify-between items-center p-4">
                                                        <div className="grid grid-cols-3 grid-rows-2 text-small-regular gap-x-4 flex-1">
                                                            <span className="font-semibold">
                                                                Date placed
                                                            </span>
                                                            <span className="font-semibold">
                                                                Order number
                                                            </span>
                                                            <span className="font-semibold">
                                                                Total amount
                                                            </span>
                                                            <span data-testid="order-created-date">
                                                                {new Date(
                                                                    order.created_at,
                                                                ).toDateString()}
                                                            </span>
                                                            <span
                                                                data-testid="order-id"
                                                                data-value={order.display_id}
                                                            >
                                                                #{order.display_id}
                                                            </span>
                                                            <span data-testid="order-amount">
                                                                {convertToLocale({
                                                                    amount: order.total,
                                                                    currency_code:
                                                                        order.currency_code,
                                                                })}
                                                            </span>
                                                        </div>
                                                        <button
                                                            className="flex items-center justify-between"
                                                            data-testid="open-order-button"
                                                        >
                                                            <span className="sr-only">
                                                                Go to order #{order.display_id}
                                                            </span>
                                                            <ChevronDown className="-rotate-90" />
                                                        </button>
                                                    </Container>
                                                </LocalizedClientLink>
                                            </li>
                                        );
                                    })
                                ) : (
                                    <span data-testid="no-orders-message">No recent orders</span>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const getProfileCompletion = (customer: HttpTypes.StoreCustomer | null) => {
    let count = 0;

    if (!customer) {
        return 0;
    }

    if (customer.email) {
        count++;
    }

    if (customer.first_name && customer.last_name) {
        count++;
    }

    if (customer.phone) {
        count++;
    }

    const billingAddress = customer.addresses?.find((addr) => addr.is_default_billing);

    if (billingAddress) {
        count++;
    }

    return (count / 4) * 100;
};

export default Overview;
```

## Source copy: `apps/storefront/src/app/[countryCode]/(main)/order/[id]/confirmed/page.tsx`

```tsx
import { retrieveCustomerNextTier } from "@lib/data/customer";
import { retrieveOrder } from "@lib/data/orders";
import OrderCompletedTemplate from "@modules/order/templates/order-completed-template";
import { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = {
    params: Promise<{ id: string; countryCode: string }>;
};
export const metadata: Metadata = {
    title: "Order Confirmed",
    description: "You purchase was successful",
};

export default async function OrderConfirmedPage(props: Props) {
    const params = await props.params;
    const order = await retrieveOrder(params.id).catch(() => null);
    const tierData = await retrieveCustomerNextTier(params.countryCode);

    if (!order) {
        return notFound();
    }

    return <OrderCompletedTemplate order={order} tierData={tierData} />;
}
```

## Source copy: `apps/storefront/src/modules/order/templates/order-completed-template.tsx`

```tsx
import { Heading } from "@modules/common/components/ui";
import { cookies as nextCookies } from "next/headers";

import CartTotals from "@modules/common/components/cart-totals";
import Help from "@modules/order/components/help";
import Items from "@modules/order/components/items";
import OnboardingCta from "@modules/order/components/onboarding-cta";
import OrderDetails from "@modules/order/components/order-details";
import ShippingDetails from "@modules/order/components/shipping-details";
import PaymentDetails from "@modules/order/components/payment-details";
import { HttpTypes } from "@medusajs/types";
import CustomerTier from "@modules/common/customer-tier";
import type { CustomerNextTier } from "types/tier";

type OrderCompletedTemplateProps = {
    order: HttpTypes.StoreOrder;
    tierData: CustomerNextTier | null;
};

export default async function OrderCompletedTemplate({
    order,
    tierData,
}: OrderCompletedTemplateProps) {
    const cookies = await nextCookies();

    const isOnboarding = cookies.get("_medusa_onboarding")?.value === "true";

    return (
        <div className="py-6 min-h-[calc(100vh-64px)]">
            <div className="content-container flex flex-col justify-center items-center gap-y-10 max-w-4xl h-full w-full">
                {isOnboarding && <OnboardingCta orderId={order.id} />}
                <div
                    className="flex flex-col gap-4 max-w-4xl h-full bg-white w-full py-10"
                    data-testid="order-complete-container"
                >
                    <Heading
                        level="h1"
                        className="flex flex-col gap-y-3 text-ui-fg-base text-3xl mb-4"
                    >
                        <span>Thank you!</span>
                        <span>Your order was placed successfully.</span>
                    </Heading>
                    <OrderDetails order={order} />
                    <CustomerTier tierData={tierData} />
                    <Heading level="h2" className="flex flex-row text-3xl-regular">
                        Summary
                    </Heading>
                    <Items order={order} />
                    <CartTotals totals={order} />
                    <ShippingDetails order={order} />
                    <PaymentDetails order={order} />
                    <Help />
                </div>
            </div>
        </div>
    );
}
```

## Source copy: `apps/storefront/src/app/[countryCode]/(main)/layout.tsx`

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

## Source copy: `apps/storefront/src/modules/account/templates/login-template.tsx`

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
