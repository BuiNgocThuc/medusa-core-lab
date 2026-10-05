import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { retrieveActiveCustomPromotions, retrievePromotionCart } from "./cart";
import { selectConditionalPromotion } from "./candidates";
import { syncConditionalPromotions } from "./sync";

export const refreshConditionalPromotionsStep = createStep(
    "refresh-conditional-promotions",
    async ({ cart_id }: { cart_id: string }, { container }) => {
        const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as {
            debug: (message: string) => void;
        };
        const cart = await retrievePromotionCart(container, cart_id);

        const { configs, promotions } = await retrieveActiveCustomPromotions(container);
        // console.log("cart: ", cart, " - configs: ", configs, " - promotions: ", promotions);

        const selected = selectConditionalPromotion(cart, configs, promotions);

        console.log("[conditional] selected", {
            cart_id,
            selected_code: selected?.code,
            selected,
        });

        const code = await syncConditionalPromotions(
            container,
            logger,
            cart,
            selected,
            new Set(promotions.map((promotion: any) => promotion.code)),
        );

        // console.log("code: ", code);

        return new StepResponse(code);
    },
);
