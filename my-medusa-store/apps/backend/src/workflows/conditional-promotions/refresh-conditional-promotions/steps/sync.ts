import {
    ContainerRegistrationKeys,
    Modules,
    PromotionActions,
} from "@medusajs/framework/utils";
import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows";
import {
    FLASH_PROMOTION_CODE_PREFIX,
    RACKET_SUMMER_GET_SOCK_PROMOTION_CODE,
    VIP_BUNDLE_PROMOTION_CODE,
} from "@/constant";
import {
    PROMOTION_ENTITLEMENT_MODULE,
    PromotionEntitlementModuleService,
} from "@/modules/promotion-entitlement";
import { orderPromotionCodes } from "@/utils";
import { ConditionalPromotionCandidate } from "./types";
import { isFlashSaleCarrier } from "@/workflows/flash-sales";

// The Summer carrier must always be managed, even if the promotion lookup is
// temporarily unavailable during a cart refresh. Otherwise an ineligible code
// can remain on a cart because it is incorrectly treated as a manual code.
const BUILT_IN_CONDITIONAL_CODES = new Set([
    VIP_BUNDLE_PROMOTION_CODE,
    RACKET_SUMMER_GET_SOCK_PROMOTION_CODE,
]);

function isManagedConditionalPromotion(promotion: any, customCodes: Set<string>) {
    const code = promotion.code ?? "";
    return (
        BUILT_IN_CONDITIONAL_CODES.has(code) ||
        customCodes.has(code) ||
        code.startsWith(FLASH_PROMOTION_CODE_PREFIX) ||
        isFlashSaleCarrier(promotion)
    );
}

function existingPromotionCodes(cart: any) {
    return (cart.promotions ?? []).map((promotion: any) => promotion.code).filter(Boolean);
}

function samePromotionCodes(nextCodes: string[], currentCodes: string[]) {
    return (
        nextCodes.length === currentCodes.length &&
        nextCodes.every((code) => currentCodes.includes(code))
    );
}

async function replaceCartPromotions(container: any, cartId: string, promoCodes: string[]) {
    const { result } = await updateCartPromotionsWorkflow(container).run({
        input: {
            cart_id: cartId,
            promo_codes: promoCodes,
            action: PromotionActions.REPLACE,
            force_refresh_payment_collection: false,
        },
    });

    console.log("[conditional] updateCartPromotionsWorkflow result", {
        cart_id: cartId,
        requested_promo_codes: promoCodes,
        skipped_promo_codes: result?.skipped_promo_codes,
    });

    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({
        entity: "cart",
        fields: ["id", "promotions.code", "metadata"],
        filters: { id: cartId },
    });

    console.log("[conditional] cart after replace", {
        cart_id: cartId,
        promotion_codes: data[0]?.promotions?.map((promotion) => promotion.code),
        metadata: data[0]?.metadata,
    });
}

async function syncConditionalMetadata(
    container: any,
    cart: any,
    selected: ConditionalPromotionCandidate | null,
) {
    const promotionIds = selected?.custom && selected.promoId ? [selected.promoId] : [];
    const configIds = selected?.custom && selected.configId ? [selected.configId] : [];
    const metadata = cart.metadata ?? {};
    const isCurrent =
        JSON.stringify(metadata.conditional_promotion_ids ?? []) === JSON.stringify(promotionIds) &&
        JSON.stringify(metadata.conditional_promotion_config_ids ?? []) ===
            JSON.stringify(configIds);

    if (isCurrent) return;

    const cartModule = container.resolve(Modules.CART) as any;
    await cartModule.updateCarts(cart.id, {
        metadata: {
            ...metadata,
            conditional_promotion_ids: promotionIds,
            conditional_promotion_config_ids: configIds,
        },
    });
}

export async function syncConditionalPromotions(
    container: any,
    logger: { debug: (message: string) => void },
    cart: any,
    selected: ConditionalPromotionCandidate | null,
    customCodes: Set<string>,
) {
    const currentCodes = existingPromotionCodes(cart);
    const retainedPromotions = (cart.promotions ?? []).filter(
        (promotion: any) => !isManagedConditionalPromotion(promotion, customCodes),
    );
    const entitlementService = container.resolve(
        PROMOTION_ENTITLEMENT_MODULE,
    ) as PromotionEntitlementModuleService;
    const hasClaimedFlash = (cart.promotions ?? []).some(
        (promotion: any) => promotion.metadata?.flash_source === true,
    );

    logger.debug(
        `[conditional-promotions] syncing ${JSON.stringify({
            cart_id: cart.id,
            current_codes: currentCodes,
            retained_codes: retainedPromotions.map((promotion: any) => promotion.code),
            selected_code: selected?.code ?? null,
        })}`,
    );

    if (!selected) {
        const promoCodes = orderPromotionCodes(retainedPromotions, {
            loyaltyPromotionId: cart.metadata?.loyalty_promo_id,
        });
        if (!samePromotionCodes(promoCodes, currentCodes)) {
            await replaceCartPromotions(container, cart.id, promoCodes);
        }
        if (!hasClaimedFlash) await entitlementService.releaseFlashRedemption(cart.id);
        await syncConditionalMetadata(container, cart, null);
        return null;
    }

    if (!hasClaimedFlash) {
        await entitlementService.releaseFlashRedemption(cart.id);
    }

    const promoCodes = orderPromotionCodes(
        [{ id: selected.code, code: selected.code, is_automatic: true }, ...retainedPromotions],
        {
            automaticCodes: [selected.code],
            loyaltyPromotionId: cart.metadata?.loyalty_promo_id,
        },
    );
    if (!samePromotionCodes(promoCodes, currentCodes)) {
        await replaceCartPromotions(container, cart.id, promoCodes);
    }
    await syncConditionalMetadata(container, cart, selected);

    return selected.code;
}
