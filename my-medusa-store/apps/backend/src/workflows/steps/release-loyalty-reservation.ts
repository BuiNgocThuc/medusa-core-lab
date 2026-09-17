import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { LOYALTY_MODULE, LoyaltyModuleService } from "@/src/modules/loyalty"

export const releaseLoyaltyReservationStep = createStep(
    "release-loyalty-reservation",
    async ({ customer_id, cart_id }: { customer_id: string; cart_id: string }, { container }) => {
        const loyalty: LoyaltyModuleService = container.resolve(LOYALTY_MODULE)
        const [reservation] = await loyalty.listLoyaltyTransactions({
            type: "redemption_reservation",
            reference_id: cart_id,
        })

        if (!reservation || reservation.status !== "reserved") {
            return new StepResponse(null)
        }

        const result = await loyalty.releaseReservation(customer_id, cart_id, -reservation.points)
        return new StepResponse(result)
    },
)
