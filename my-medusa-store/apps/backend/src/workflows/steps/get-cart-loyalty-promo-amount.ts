import { PromotionDTO, CustomerDTO } from "@medusajs/framework/types";
import { MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { LOYALTY_MODULE, LoyaltyModuleService } from "@/src/modules/loyalty";
import { LOYALTY_REDEEM_VND_PER_BLOCK } from "@/src/constant.ts";

const GET_CART_LOYALTY_PROMO_AMOUNT_STEP_ID = "get-cart-loyalty-promo-amount";
export type GetCartLoyaltyPromoAmountStepInput = {
    cart: {
        id: string;
        customer: CustomerDTO;
        promotions?: PromotionDTO[];
        total: number;
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

        const availableDiscount =
            await loyaltyModuleService.calculateDiscountAmountFromPoints(loyaltyPoints);

        const maxCartDiscount =
            Math.floor(cart.total / LOYALTY_REDEEM_VND_PER_BLOCK) * LOYALTY_REDEEM_VND_PER_BLOCK;

        const amount = Math.min(availableDiscount, maxCartDiscount);

        if (amount <= 0) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Cart total is too low for a loyalty redemption block",
            );
        }

        return new StepResponse(amount);
    },
);
