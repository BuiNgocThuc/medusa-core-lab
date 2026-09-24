import { PromotionDTO, CustomerDTO } from "@medusajs/framework/types";
import { MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { LOYALTY_MODULE, LoyaltyModuleService } from "@/src/modules/loyalty";

const GET_CART_LOYALTY_PROMO_AMOUNT_STEP_ID = "get-cart-loyalty-promo-amount";
export type GetCartLoyaltyPromoAmountStepInput = {
    cart: {
        id: string;
        customer: CustomerDTO;
        promotions?: PromotionDTO[];
        total: number;
        points: number;
    };
};

export const getCartLoyaltyPromoAmountStep = createStep(
    GET_CART_LOYALTY_PROMO_AMOUNT_STEP_ID,
    async ({ cart }: GetCartLoyaltyPromoAmountStepInput, { container }) => {
        // Check if customer has any loyalty points
        const loyaltyModuleService: LoyaltyModuleService = container.resolve(LOYALTY_MODULE);
        const loyaltyPoints = await loyaltyModuleService.getPoints(cart.customer.id);
        //
        // if (loyaltyPoints <= 0) {
        //     throw new MedusaError(MedusaError.Types.INVALID_DATA, "Customer has no loyalty points");
        // }
        //
        // const pointsAmount = await loyaltyModuleService.calculatePointsFromAmount(loyaltyPoints);
        //
        // const amount = Math.min(pointsAmount, cart.total);
        //
        // return new StepResponse(amount);

        if (loyaltyPoints < cart.points) {
            throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Không đủ điểm tích lũy");
        }

        const amount = await loyaltyModuleService.calculateDiscountAmountFromPoints(cart.points);

        if (amount <= 0 || amount > cart.total) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Số điểm đổi vượt giá trị giỏ hàng",
            );
        }

        return new StepResponse(amount);
    },
);
