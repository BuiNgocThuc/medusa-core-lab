import {
    VIP_BUNDLE_PROMOTION_CODE,
    VIP_TIER_NAME,
} from "@/constant";
import { evaluateConditionalPromotion } from "../../evaluate-rule-tree";
import { ConditionalPromotionCandidate } from "./types";

function quantityFor(items: any[], category: string) {
    return items.reduce((total, item) => {
        const categories = item.variant?.product?.product_categories ?? [];
        return (
            total +
            (categories.some((entry: any) => entry.name === category) ? Number(item.quantity) : 0)
        );
    }, 0);
}

function eligibleItems(items: any[], category: string) {
    return items.filter((item) =>
        (item.variant?.product?.product_categories ?? []).some(
            (entry: any) => entry.name === category,
        ),
    );
}

function calculateVipDiscount(items: any[]) {
    return items
        .flatMap((item) =>
            Array.from({ length: Number(item.quantity) }, () => Number(item.unit_price)),
        )
        .sort((a, b) => a - b)
        .slice(0, 3)
        .reduce((total, price) => total + Math.floor((price * 15) / 100), 0);
}

function vipCandidate(cart: any): ConditionalPromotionCandidate | null {
    const items = cart.items ?? [];
    const isVietnam =
        cart.region?.name === "Vietnam" &&
        (!cart.shipping_address?.country_code ||
            cart.shipping_address.country_code.toLowerCase() === "vn");
    const isEligible =
        cart.customer?.has_account === true &&
        cart.customer?.tier?.name === VIP_TIER_NAME &&
        isVietnam &&
        Number(cart.subtotal) >= 2_000_000 &&
        quantityFor(items, "Rackets") >= 2 &&
        quantityFor(items, "Shoes") >= 1;

    if (!isEligible) return null;

    return {
        code: VIP_BUNDLE_PROMOTION_CODE,
        amount: calculateVipDiscount([
            ...eligibleItems(items, "Rackets"),
            ...eligibleItems(items, "Shoes"),
        ]),
        priority: 2,
    };
}

function configuredCandidates(configs: any[], promotions: any[], items: any[]) {
    return configs.flatMap((config: any) => {
        const amount = evaluateConditionalPromotion(config, items);
        const promotion = promotions.find((entry: any) => entry.id === config.promo_id);

        if (!amount || !promotion?.code) return [];

        return [
            {
                code: promotion.code,
                amount,
                priority: Number(config.priority),
                custom: true,
                promoId: promotion.id,
                configId: config.id,
            } satisfies ConditionalPromotionCandidate,
        ];
    });
}

export function selectConditionalPromotion(
    cart: any,
    configs: any[],
    promotions: any[],
): ConditionalPromotionCandidate | null {
    const customPromotionCandidates = configuredCandidates(configs, promotions, cart.items ?? []);

    // Flash Sale (Condition 3) is intentionally on hold. Its existing code is
    // treated as managed by sync, so the next refresh removes it from the cart.
    const candidates = [
        vipCandidate(cart),
        ...customPromotionCandidates,
    ].filter((candidate): candidate is ConditionalPromotionCandidate => candidate != null);

    return (
        candidates.sort(
            (left, right) => right.amount - left.amount || right.priority - left.priority,
        )[0] ?? null
    );
}
