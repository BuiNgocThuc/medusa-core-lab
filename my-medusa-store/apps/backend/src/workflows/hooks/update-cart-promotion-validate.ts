import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows";
import {
    ContainerRegistrationKeys,
    MedusaError,
    PromotionActions,
} from "@medusajs/framework/utils";
import { FIRST_PURCHASE_PROMOTION_CODE } from "@/src/constant";

type Promotion = {
    id: string;
    code?: string | null;
};

type Tier = {
    id: string;
    promo_id?: string | null;
};

function throwInvalidPromotion(message: string): never {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, message);
}

function isAddingPromotions(
    action: PromotionActions | undefined,
    promoCodes?: string[] | null,
): promoCodes is string[] {
    const isAddOrReplace = action === PromotionActions.ADD || action === PromotionActions.REPLACE;

    return isAddOrReplace && Boolean(promoCodes?.length);
}

function validateFirstPurchasePromotion(
    promoCodes: string[],
    customer?: {
        has_account?: boolean | null;
        orders?: unknown[] | null;
    },
): void {
    const hasFirstPurchasePromotion = promoCodes.includes(FIRST_PURCHASE_PROMOTION_CODE);

    if (!hasFirstPurchasePromotion) {
        return;
    }

    if (!customer) {
        throwInvalidPromotion(
            "First purchase discount can only be applied to carts with a customer",
        );
    }

    const hasPreviousOrders = (customer.orders?.length ?? 0) > 0;

    if (!customer.has_account || hasPreviousOrders) {
        throwInvalidPromotion(
            "First purchase discount can only be applied to customers with an account and no previous orders",
        );
    }
}

function validateTierPromotions(
    promotions: Promotion[],
    tiers: Tier[],
    customerTierId?: string,
): void {
    const tierByPromotionId = new Map(
        tiers
            .filter((tier): tier is Tier & { promo_id: string } => Boolean(tier.promo_id))
            .map((tier) => [tier.promo_id, tier.id]),
    );

    for (const promotion of promotions) {
        const requiredTierId = tierByPromotionId.get(promotion.id);

        if (requiredTierId && customerTierId !== requiredTierId) {
            throwInvalidPromotion(
                `Promotion ${
                    promotion.code ?? promotion.id
                } can only be applied by customers in the corresponding tier.`,
            );
        }
    }
}

updateCartPromotionsWorkflow.hooks.validate(async ({ input, cart }, { container }) => {
    if (!isAddingPromotions(input.action, input.promo_codes)) {
        return;
    }

    // Sau type guard, TypeScript biết đây chắc chắn là string[].
    const promoCodes = input.promo_codes;
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    /*
     * Query customer một lần cho cả:
     * - First-purchase validation
     * - Tier validation
     */
    const customerResult = cart.customer_id
        ? await query.graph({
              entity: "customer",
              fields: ["id", "has_account", "orders.id", "tier.id"],
              filters: {
                  id: cart.customer_id,
              },
          })
        : null;

    const customer = customerResult?.data?.[0];

    validateFirstPurchasePromotion(promoCodes, customer);

    const { data: promotionResults } = await query.graph({
        entity: "promotion",
        fields: ["id", "code"],
        filters: {
            code: promoCodes,
        },
    });

    // Loại bỏ null và undefined do Medusa trả về Maybe<Promotion>[].
    const promotions = (promotionResults ?? []).filter(
        (promotion): promotion is NonNullable<typeof promotion> => promotion != null,
    );

    if (promotions.length === 0) {
        return;
    }

    const promotionIds = promotions.map((promotion) => promotion.id);

    const { data: tierResults } = await query.graph({
        entity: "tier",
        fields: ["id", "promo_id"],
        filters: {
            promo_id: promotionIds,
        },
    });

    const tiers = (tierResults ?? []).filter(
        (tier): tier is NonNullable<typeof tier> => tier != null,
    );

    validateTierPromotions(promotions, tiers, customer?.tier?.id);
});
