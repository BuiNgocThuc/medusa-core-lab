import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { LOYALTY_MODULE, LoyaltyModuleService } from "@/src/modules/loyalty";

const ADD_PURCHASE_AS_POINT_STEP_ID = "add-purchase-as-points";

type AddPurchaseAsPointsStepInput = {
    customer_id: string;
    amount: number;
};

export const addPurchaseAsPointsStep = createStep(
    ADD_PURCHASE_AS_POINT_STEP_ID,

    async ({ customer_id, amount }: AddPurchaseAsPointsStepInput, { container }) => {
        const loyaltyModuleService: LoyaltyModuleService = container.resolve(LOYALTY_MODULE);

        const pointsToAdd = await loyaltyModuleService.calculatePointsFromAmount(amount);

        const result = await loyaltyModuleService.addPoints(customer_id, pointsToAdd);

        return new StepResponse(result, {
            customer_id: customer_id,
            points: pointsToAdd,
        });
    },

    async (data, { container }) => {
        if (!data) {
            return;
        }

        const loyaltyModuleService: LoyaltyModuleService = container.resolve(LOYALTY_MODULE);

        await loyaltyModuleService.deductPoints(data.customer_id, data.points);
    },
);
