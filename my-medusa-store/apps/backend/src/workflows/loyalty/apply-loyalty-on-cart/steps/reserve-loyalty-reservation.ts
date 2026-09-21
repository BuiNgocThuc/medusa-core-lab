import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { LOYALTY_MODULE, LoyaltyModuleService } from "@/src/modules/loyalty"

export const reserveLoyaltyReservationStep = createStep(
    "reserve-loyalty-reservation",
    async (input: {
        customer_id: string
        cart_id: string
        promotion_id: string
        points: number
    }, { container }) => {
        const loyalty = container.resolve(LOYALTY_MODULE) as LoyaltyModuleService
        const reservation = await loyalty.reservePointsForCart({
            ...input,
            expires_at: new Date(Date.now() + 30 * 60 * 1000),
        })
        return new StepResponse(reservation)
    },
)
