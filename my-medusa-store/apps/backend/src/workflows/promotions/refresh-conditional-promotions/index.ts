import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError, Modules, PromotionActions } from "@medusajs/framework/utils"
import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import {
    FLASH_CAMPAIGN_IDENTIFIER,
    FLASH_PROMOTION_CODE_PREFIX,
    FLASH_PROMOTION_MAX_DISCOUNT,
    RACKET_SUMMER_GET_SOCK_PROMOTION_CODE,
    VIP_BUNDLE_PROMOTION_CODE,
    VIP_TIER_NAME,
} from "@/src/constant"
import {
    PROMOTION_ENTITLEMENT_MODULE,
    PromotionEntitlementModuleService,
} from "@/src/modules/promotion-entitlement"

type Candidate = { code: string; amount: number; priority: number; flash?: boolean }

const CONDITIONAL_CODES = new Set([
    VIP_BUNDLE_PROMOTION_CODE,
    RACKET_SUMMER_GET_SOCK_PROMOTION_CODE,
])

function quantityFor(items: any[], category: string) {
    return items.reduce((total, item) => {
        const categories = item.variant?.product?.product_categories ?? []
        return total + (categories.some((entry: any) => entry.name === category) ? Number(item.quantity) : 0)
    }, 0)
}

function eligibleItems(items: any[], category: string) {
    return items.filter((item) =>
        (item.variant?.product?.product_categories ?? []).some((entry: any) => entry.name === category),
    )
}

function isFlashWindow(now = new Date()) {
    const hour = Number(new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        hourCycle: "h23",
    }).format(now))
    return hour >= 18 && hour < 22
}

function calculateVipDiscount(items: any[]) {
    return items
        .flatMap((item) => Array.from({ length: Number(item.quantity) }, () => Number(item.unit_price)))
        .sort((a, b) => a - b)
        .slice(0, 3)
        .reduce((total, price) => total + Math.floor((price * 15) / 100), 0)
}

function calculateBuyGetDiscount(items: any[]) {
    return items.reduce((highest, item) => Math.max(highest, Number(item.unit_price)), 0)
}

const refreshConditionalPromotionsStep = createStep(
    "refresh-conditional-promotions",
    async ({ cart_id }: { cart_id: string }, { container }) => {
        const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
        const promotionModule = container.resolve(Modules.PROMOTION) as any
        const entitlementService = container.resolve(
            PROMOTION_ENTITLEMENT_MODULE,
        ) as PromotionEntitlementModuleService
        const { data } = await query.graph({
            entity: "cart",
            fields: [
                "id", "subtotal", "customer.id", "customer.tier.name", "region.name",
                "shipping_address.country_code", "items.quantity", "items.unit_price",
                "items.variant.product.product_categories.name", "items.variant.product.collection.handle",
                "promotions.code",
            ],
            filters: { id: cart_id },
        })
        const cart = data[0]
        if (!cart) return new StepResponse(null)

        const items = cart.items ?? []
        const rackets = eligibleItems(items, "Rackets")
        const shoes = eligibleItems(items, "Shoes")
        const socks = eligibleItems(items, "Socks")
        const isVietnam = cart.region?.name === "Vietnam" &&
            (!cart.shipping_address?.country_code || cart.shipping_address.country_code.toLowerCase() === "vn")
        const candidates: Candidate[] = []
        if (cart.customer?.tier?.name === VIP_TIER_NAME && isVietnam && Number(cart.subtotal) >= 2_000_000 && quantityFor(items, "Rackets") >= 2 && quantityFor(items, "Shoes") >= 1) {
            candidates.push({ code: VIP_BUNDLE_PROMOTION_CODE, amount: calculateVipDiscount([...rackets, ...shoes]), priority: 2 })
        }
        if (quantityFor(items, "Rackets") >= 2 && rackets.some((item: any) => item.variant?.product?.collection?.handle === "summer") && socks.length) {
            candidates.push({ code: RACKET_SUMMER_GET_SOCK_PROMOTION_CODE, amount: calculateBuyGetDiscount(socks), priority: 3 })
        }
        if (cart.customer?.id && isFlashWindow() && Number(cart.subtotal) > 0) {
            candidates.push({
                code: `${FLASH_PROMOTION_CODE_PREFIX}${cart.id}`,
                amount: Math.min(Math.floor(Number(cart.subtotal) * 0.2), FLASH_PROMOTION_MAX_DISCOUNT),
                priority: 1,
                flash: true,
            })
        }
        const selected = candidates.sort((a, b) => b.amount - a.amount || b.priority - a.priority)[0]
        const existingCodes = (cart.promotions ?? []).map((promotion: any) => promotion.code).filter(Boolean)

        if (!selected) {
            const remaining = existingCodes.filter((code: string) => !CONDITIONAL_CODES.has(code) && !code.startsWith(FLASH_PROMOTION_CODE_PREFIX))
            if (remaining.length !== existingCodes.length) {
                await updateCartPromotionsWorkflow(container).run({ input: { cart_id, promo_codes: remaining, action: PromotionActions.REPLACE } })
            }
            await entitlementService.releaseFlashRedemption(cart_id)
            return new StepResponse(null)
        }

        if (selected.flash) {
            const [existing] = await promotionModule.listPromotions({ code: selected.code })
            const [campaignPromotion] = await promotionModule.listPromotions({ code: `${FLASH_PROMOTION_CODE_PREFIX}SEED` }, { relations: ["campaign"] })
            const campaignId = campaignPromotion?.campaign_id ?? campaignPromotion?.campaign?.id
            if (!campaignId) {
                throw new MedusaError(
                    MedusaError.Types.INVALID_DATA,
                    `Missing ${FLASH_CAMPAIGN_IDENTIFIER} campaign seed`,
                )
            }
            const application_method = { type: "fixed", value: selected.amount, target_type: "order", allocation: "across", currency_code: "vnd" }
            if (existing) {
                await promotionModule.updatePromotions({ id: existing.id, status: "active", application_method })
            } else {
                await promotionModule.createPromotions({
                    code: selected.code, type: "standard", status: "active", is_automatic: false, campaign_id: campaignId,
                    application_method, rules: [{ attribute: "customer_id", operator: "eq", values: [cart.customer.id] }],
                })
            }
            await entitlementService.reserveFlashRedemption(cart.customer.id, cart_id, selected.amount)
        } else {
            await entitlementService.releaseFlashRedemption(cart_id)
        }

        if (existingCodes.length !== 1 || existingCodes[0] !== selected.code) {
            await updateCartPromotionsWorkflow(container).run({ input: { cart_id, promo_codes: [selected.code], action: PromotionActions.REPLACE } })
        }
        return new StepResponse(selected.code)
    },
)

export const refreshConditionalPromotionsWorkflow = createWorkflow(
    "refresh-conditional-promotions",
    ({ cart_id }: { cart_id: string }) => new WorkflowResponse(refreshConditionalPromotionsStep({ cart_id })),
)
