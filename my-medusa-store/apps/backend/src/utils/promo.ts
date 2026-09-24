import { PromotionDTO, CustomerDTO, CartDTO, OrderDTO } from "@medusajs/framework/types";
import { CUSTOMER_ID_PROMOTION_RULE_ATTRIBUTE } from "@/src/constant";

export type CartData = CartDTO & {
    promotions?: PromotionDTO[];
    customer?: CustomerDTO;
    metadata: {
        loyalty_promo_id?: string;
    };
};

export type OrderData = OrderDTO & {
    promotion?: PromotionDTO[];
    customer?: CustomerDTO;
    cart?: CartData;
};

type PromotionForOrdering = Pick<PromotionDTO, "id" | "code" | "is_automatic">;

type PromotionOrderOptions = {
    loyaltyPromotionId?: string | null;
    automaticCodes?: string[];
};

/**
 * Keeps promotion updates in the business order used at checkout.
 *
 * A loyalty promotion is created per cart and isn't marked as automatic by
 * Medusa, so identify it from the cart metadata instead of its code.
 */
export function orderPromotionCodes(
    promotions: PromotionForOrdering[] | undefined,
    options: PromotionOrderOptions = {},
): string[] {
    const automaticCodes = new Set(options.automaticCodes);
    const ordered = [
        [] as string[],
        [] as string[],
        [] as string[],
    ];

    for (const promotion of promotions ?? []) {
        if (!promotion.code) continue;

        const group = promotion.id === options.loyaltyPromotionId
            ? 2
            : promotion.is_automatic || automaticCodes.has(promotion.code)
                ? 0
                : 1;
        ordered[group].push(promotion.code);
    }

    return [...new Set(ordered.flat())];
}

export function orderHasLoyaltyPromotion(order: OrderData): boolean {
    const loyaltyPromotion = getCartLoyaltyPromotion(order.cart as unknown as CartData);

    return (
        loyaltyPromotion?.rules?.some((rule) => {
            return (
                rule?.attribute === CUSTOMER_ID_PROMOTION_RULE_ATTRIBUTE &&
                (rule?.values?.some((value) => value.value === order.customer?.id) || false)
            );
        }) || false
    );
}

export function getCartLoyaltyPromotion(cart: CartData): PromotionDTO | undefined {
    if (!cart?.metadata?.loyalty_promo_id) {
        return;
    }

    return cart.promotions?.find((promotion) => promotion.id === cart.metadata.loyalty_promo_id);
}
