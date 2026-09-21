import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { LOYALTY_MODULE, LoyaltyModuleService } from "@/src/modules/loyalty";

const DEDUCT_PURCHASE_POINT_STEP_ID = "deduct-purchase-point";

type DeductPurchasePointsStepInput = {
    customer_id: string;
    amount: number;
};

export const deductPurchasePointsStep = createStep(
    DEDUCT_PURCHASE_POINT_STEP_ID,
    async ({ customer_id, amount }: DeductPurchasePointsStepInput, { container }) => {
        const loyaltyModuleService: LoyaltyModuleService = container.resolve(LOYALTY_MODULE);

        const pointsToDeduct = await loyaltyModuleService.calculatePointsFromDiscountAmount(amount);

        const result = await loyaltyModuleService.deductPoints(customer_id, pointsToDeduct);

        return new StepResponse(result, {
            customer_id,
            points: pointsToDeduct,
        });
    },
    async (data, { container }) => {
        if (!data) return;

        const loyaltyModuleService: LoyaltyModuleService = container.resolve(LOYALTY_MODULE);

        await loyaltyModuleService.addPoints(data.customer_id, data.points);
    },
);
