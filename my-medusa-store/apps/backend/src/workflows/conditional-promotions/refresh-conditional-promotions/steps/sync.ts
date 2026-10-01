import {
    ContainerRegistrationKeys,
    MedusaError,
    Modules,
    PromotionActions,
} from "@medusajs/framework/utils";
import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows";
import {
    FLASH_CAMPAIGN_IDENTIFIER,
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

// The Summer carrier must always be managed, even if the promotion lookup is
// temporarily unavailable during a cart refresh. Otherwise an ineligible code
// can remain on a cart because it is incorrectly treated as a manual code.
const BUILT_IN_CONDITIONAL_CODES = new Set([
    VIP_BUNDLE_PROMOTION_CODE,
    RACKET_SUMMER_GET_SOCK_PROMOTION_CODE,
]);

function isManagedConditionalPromotion(code: string, customCodes: Set<string>) {
    return (
        BUILT_IN_CONDITIONAL_CODES.has(code) ||
        customCodes.has(code) ||
        code.startsWith(FLASH_PROMOTION_CODE_PREFIX)
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

async function syncFlashPromotion(
    container: any,
    cart: any,
    candidate: ConditionalPromotionCandidate,
) {
    const promotionModule = container.resolve(Modules.PROMOTION) as any;
    const entitlementService = container.resolve(
        PROMOTION_ENTITLEMENT_MODULE,
    ) as PromotionEntitlementModuleService;
    const [existing] = await promotionModule.listPromotions({ code: candidate.code });
    const [campaignPromotion] = await promotionModule.listPromotions(
        { code: `${FLASH_PROMOTION_CODE_PREFIX}SEED` },
        { relations: ["campaign"] },
    );
    const campaignId = campaignPromotion?.campaign_id ?? campaignPromotion?.campaign?.id;

    if (!campaignId) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Missing ${FLASH_CAMPAIGN_IDENTIFIER} campaign seed`,
        );
    }

    const applicationMethod = {
        type: "fixed",
        value: candidate.amount,
        target_type: "order",
        allocation: "across",
        currency_code: "vnd",
    };

    if (existing) {
        await promotionModule.updatePromotions({
            id: existing.id,
            status: "active",
            application_method: applicationMethod,
        });
    } else {
        await promotionModule.createPromotions({
            code: candidate.code,
            type: "standard",
            status: "active",
            is_automatic: false,
            campaign_id: campaignId,
            application_method: applicationMethod,
            rules: [{ attribute: "customer_id", operator: "eq", values: [cart.customer.id] }],
        });
    }

    await entitlementService.reserveFlashRedemption(cart.customer.id, cart.id, candidate.amount);
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
        (promotion: any) => !isManagedConditionalPromotion(promotion.code, customCodes),
    );
    const entitlementService = container.resolve(
        PROMOTION_ENTITLEMENT_MODULE,
    ) as PromotionEntitlementModuleService;

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
        await entitlementService.releaseFlashRedemption(cart.id);
        await syncConditionalMetadata(container, cart, null);
        return null;
    }

    if (selected.flash) {
        await syncFlashPromotion(container, cart, selected);
    } else {
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
