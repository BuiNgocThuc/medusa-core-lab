import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { CartData, getCartLoyaltyPromotion } from "../../utils/promo";
import { MedusaError } from "@medusajs/framework/utils";

type GetCartLoyaltyPromoStepInput = {
    cart: CartData;
    throwErrorOn?: "found" | "not-found";
};

const GET_CART_LOYALTY_PROMO_STEP_ID = "get-cart-loyalty-promo";

export const getCartLoyaltyPromoStep = createStep(
    GET_CART_LOYALTY_PROMO_STEP_ID,
    async ({ cart, throwErrorOn }: GetCartLoyaltyPromoStepInput) => {
        const loyaltyPromo = getCartLoyaltyPromotion(cart);

        if (throwErrorOn === "found" && loyaltyPromo) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Ưu đãi đổi điểm đã được áp dụng",
            );
        } else if (throwErrorOn === "not-found" && !loyaltyPromo) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Không tìm thấy ưu đãi đổi điểm",
            );
        }

        return new StepResponse(loyaltyPromo);
    },
);
