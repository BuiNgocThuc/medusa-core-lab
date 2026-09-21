import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { LOYALTY_MODULE, LoyaltyModuleService } from "@/src/modules/loyalty"

export const releaseLoyaltyReservationStep = createStep(
    "release-loyalty-reservation",
    async ({ cart_id }: { cart_id: string }, { container }) => {
        const loyalty = container.resolve(LOYALTY_MODULE) as LoyaltyModuleService
        return new StepResponse(await loyalty.releaseReservation(cart_id))
    },
)
