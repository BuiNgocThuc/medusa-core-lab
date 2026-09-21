import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LOYALTY_MODULE, LoyaltyModuleService } from "@/src/modules/loyalty"
import { CartData, getCartLoyaltyPromotion } from "@/src/utils"

export const consumeLoyaltyPointsForCheckoutStep = createStep(
    "consume-loyalty-points-for-checkout",
    async ({ cart_id }: { cart_id: string }, { container }) => {
        const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
        const loyalty = container.resolve(LOYALTY_MODULE) as LoyaltyModuleService
        const { data: carts } = await query.graph(
            {
                entity: "cart",
                fields: [
                    "id", "customer.id", "metadata", "promotions.*",
                    "promotions.rules.*", "promotions.rules.values.*",
                    "promotions.application_method.*",
                ],
                filters: { id: cart_id },
            },
            { throwIfKeyNotFound: true },
        )
        const cart = carts[0] as CartData
        const promotion = getCartLoyaltyPromotion(cart)
        if (!promotion) return new StepResponse(null)

        const points = await loyalty.calculatePointsFromDiscountAmount(
            promotion.application_method!.value as number,
        )
        const result = await loyalty.consumePointsForCart({
            customer_id: cart.customer!.id,
            cart_id,
            points,
            promotion_id: promotion.id,
        })
        const compensationData = result.consumed
            ? { customer_id: cart.customer!.id, cart_id, points }
            : null
        return new StepResponse(result, compensationData)
    },
    async (compensationData, { container }) => {
        if (!compensationData) return
        const loyalty = container.resolve(LOYALTY_MODULE) as LoyaltyModuleService
        await loyalty.reverseCartPointConsumption(
            compensationData.cart_id,
            compensationData.customer_id,
            compensationData.points,
        )
    },
)
