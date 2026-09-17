import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { LOYALTY_MODULE, LoyaltyModuleService } from "@/src/modules/loyalty"

export const reserveLoyaltyPointsStep = createStep(
    "reserve-loyalty-points",
    async (
        input: { customer_id: string; cart_id: string; points: number },
        { container },
    ) => {
        const loyalty: LoyaltyModuleService = container.resolve(LOYALTY_MODULE)
        const balance = await loyalty.getPoints(input.customer_id)
        if (balance < input.points) {
            throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Insufficient loyalty points")
        }

        const transaction = await loyalty.recordTransaction({
            customer_id: input.customer_id,
            type: "redemption_reservation",
            reference_id: input.cart_id,
            points: -input.points,
            status: "reserved",
            cart_id: input.cart_id,
        })

        return new StepResponse(transaction, input)
    },
    async (input, { container }) => {
        if (!input) return
        const loyalty: LoyaltyModuleService = container.resolve(LOYALTY_MODULE)
        await loyalty.releaseReservation(input.customer_id, input.cart_id, input.points)
    },
)
