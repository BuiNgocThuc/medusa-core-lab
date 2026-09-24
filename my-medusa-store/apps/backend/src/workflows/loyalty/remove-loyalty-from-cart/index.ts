import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import {
    acquireLockStep,
    releaseLockStep,
    useQueryGraphStep,
    updateCartPromotionsWorkflow,
    updateCartsStep,
    updatePromotionsStep,
} from "@medusajs/medusa/core-flows";
import { getCartLoyaltyPromoStep } from "../apply-loyalty-on-cart/steps";
import { releaseLoyaltyReservationStep } from "./steps";
import { PromotionActions } from "@medusajs/framework/utils";
import { CartData } from "@/src/utils";

type WorkflowInput = {
    cart_id: string;
};

const fields = [
    "id",
    "customer.*",
    "promotions.*",
    "promotions.application_method.*",
    "promotions.rules.*",
    "promotions.rules.values.*",
    "currency_code",
    "total",
    "metadata",
];

export const removeLoyaltyFromCartWorkflow = createWorkflow(
    "remove-loyalty-from-cart",
    (input: WorkflowInput) => {
        const { data: carts } = useQueryGraphStep({
            entity: "cart",
            fields,
            filters: {
                id: input.cart_id,
            },
            options: {
                throwIfKeyNotFound: true,
            },
        });

        const lockKeys = transform({ carts }, ({ carts }) => [
            carts[0].id,
            `loyalty-customer-${carts[0].customer!.id}`,
        ]);
        acquireLockStep({ key: lockKeys, timeout: 10, ttl: 30 });

        const loyaltyPromo = getCartLoyaltyPromoStep({
            cart: carts[0] as unknown as CartData,
            throwErrorOn: "not-found",
        });

        releaseLoyaltyReservationStep({ cart_id: input.cart_id });

        const removePromotionInput = transform(
            { input, loyaltyPromo },
            ({ input, loyaltyPromo }) => ({
                cart_id: input.cart_id,
                promo_codes: [loyaltyPromo!.code!],
                action: PromotionActions.REMOVE,
            }),
        );

        updateCartPromotionsWorkflow.runAsStep({
            input: removePromotionInput,
        });

        const newMetadata = transform(
            {
                carts,
            },
            (data) => {
                const { loyalty_promo_id, ...rest } = data.carts[0].metadata || {};

                return {
                    ...rest,
                    loyalty_promo_id: null,
                };
            },
        );

        updateCartsStep([
            {
                id: input.cart_id,
                metadata: newMetadata,
            },
        ]);

        const deactivatePromotionInput = transform({ loyaltyPromo }, ({ loyaltyPromo }) => [
            {
                id: loyaltyPromo!.id,
                status: "inactive" as const,
            },
        ]);

        updatePromotionsStep(deactivatePromotionInput);

        // retrieve cart with updated promotions
        const { data: updatedCarts } = useQueryGraphStep({
            entity: "cart",
            fields,
            filters: { id: input.cart_id },
        }).config({ name: "retrieve-cart" });

        releaseLockStep({ key: lockKeys });

        return new WorkflowResponse(updatedCarts[0]);
    },
);
