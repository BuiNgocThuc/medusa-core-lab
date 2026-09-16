import { completeCartWorkflow } from "@medusajs/medusa/core-flows";
import { MedusaError, ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { FIRST_PURCHASE_PROMOTION_CODE } from "@/src/constant";
import { CartData, getCartLoyaltyPromotion } from "@/src/utils";
import { LOYALTY_MODULE, LoyaltyModuleService } from "@/src/modules/loyalty";

type Query = {
    graph: (query: unknown, options?: unknown) => Promise<any>;
};

type Promotion = {
    id?: string;
    code?: string;
};

function throwInvalidPromotion(message: string): never {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, message);
}

async function validateTierPromotions(
    query: Query,
    promotions: Promotion[],
    customerTierId?: string,
) {
    const promotionIds = promotions
        .map((promotion) => promotion.id)
        .filter((id): id is string => Boolean(id));

    if (promotionIds.length === 0) {
        return;
    }

    const { data: tiers } = await query.graph({
        entity: "tier",
        fields: ["id", "promo_id"],
        filters: {
            promo_id: promotionIds,
        },
    });

    const tierByPromotionId = new Map<string, string>(
        tiers.map((tier: { id: string; promo_id: string }) => [tier.promo_id, tier.id]),
    );

    for (const promotion of promotions) {
        if (!promotion.id) {
            continue;
        }

        const requiredTierId = tierByPromotionId.get(promotion.id);

        if (requiredTierId && customerTierId !== requiredTierId) {
            throwInvalidPromotion(
                `Promotion ${promotion.code ?? promotion.id} can only be applied by customers in the corresponding tier.`,
            );
        }
    }
}

async function validateFirstPurchasePromotion(
    query: Query,
    promotions: Promotion[],
    customerId?: string | null,
): Promise<void> {
    const hasFirstPurchasePromotion = promotions.some(
        (promotion) => promotion.code === FIRST_PURCHASE_PROMOTION_CODE,
    );

    if (!hasFirstPurchasePromotion) {
        return;
    }

    if (!customerId) {
        throwInvalidPromotion(
            "First purchase discount can only be applied to carts with a customer",
        );
    }

    const {
        data: [customer],
    } = await query.graph(
        {
            entity: "customer",
            fields: ["id", "has_account", "orders.id"],
            filters: {
                id: customerId,
            },
        },
        {
            throwIfKeyNotFound: true,
        },
    );

    const hasPreviousOrders = (customer.orders?.length ?? 0) > 0;

    if (!customer.has_account || hasPreviousOrders) {
        throwInvalidPromotion(
            "First purchase discount can only be applied to customers with an account and no previous orders",
        );
    }
}

async function validateLoyaltyPoints(
    query: Query,
    cart_id: string,
    loyaltyModuleService: LoyaltyModuleService,
) {
    const { data: carts } = await query.graph(
        {
            entity: "cart",
            fields: [
                "id",
                "promotions.*",
                "customer.*",
                "promotions.rules.*",
                "promotions.rules.values.*",
                "promotions.application_method.*",
                "metadata",
            ],
            filters: {
                id: cart_id,
            },
        },
        {
            throwIfKeyNotFound: true,
        },
    );

    const loyaltyPromo = getCartLoyaltyPromotion(carts[0] as unknown as CartData);

    if (!loyaltyPromo) {
        return;
    }

    const customerLoyaltyPoints = await loyaltyModuleService.getPoints(carts[0].customer!.id);
    const requiredPoints = await loyaltyModuleService.calculatePointsFromAmount(
        loyaltyPromo.application_method!.value as number,
    );

    if (customerLoyaltyPoints < requiredPoints) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Customer does not have enough loyalty points. Required: ${
                requiredPoints
            }, Available: ${customerLoyaltyPoints}`,
        );
    }
}

completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const {
        data: [detailedCart],
    } = await query.graph(
        {
            entity: "cart",
            fields: ["id", "customer_id", "promotions.id", "promotions.code", "customer.tier.id"],
            filters: {
                id: cart.id,
            },
        },
        {
            throwIfKeyNotFound: true,
        },
    );

    const promotions = (detailedCart.promotions ?? []).filter(
        (promotion): promotion is NonNullable<typeof promotion> => promotion != null,
    );

    if (promotions.length === 0) {
        return;
    }

    await validateTierPromotions(query, promotions, detailedCart.customer?.tier?.id);

    await validateFirstPurchasePromotion(query, promotions, detailedCart.customer_id);

    const loyaltyModuleService: LoyaltyModuleService = container.resolve(LOYALTY_MODULE);
    await validateLoyaltyPoints(query, cart.id, loyaltyModuleService);
});
