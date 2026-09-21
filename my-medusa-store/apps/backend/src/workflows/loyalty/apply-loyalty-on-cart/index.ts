import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import {
    acquireLockStep,
    createPromotionsStep,
    releaseLockStep,
    updateCartPromotionsWorkflow,
    updateCartsStep,
    useQueryGraphStep,
} from "@medusajs/medusa/core-flows";
import {
    validateCustomerExistsStep,
    ValidateCustomerExistsStepInput,
    getCartLoyaltyPromoStep,
    getCartLoyaltyPromoAmountStep,
    reserveLoyaltyReservationStep,
    GetCartLoyaltyPromoAmountStepInput,
} from "./steps";
import { CartData } from "@/src/utils";
import { CUSTOMER_ID_PROMOTION_RULE_ATTRIBUTE } from "@/src/constant";
import { PromotionActions } from "@medusajs/framework/utils";
import { CreatePromotionDTO } from "@medusajs/framework/types";

const APPLY_LOYALTY_ON_CART_WORKFLOW_ID = "apply-loyalty-on-cart";
type ApplyLoyaltyOnCartWorkflowInput = {
    cart_id: string;
    points: number;
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

export const applyLoyaltyOnCartWorkflow = createWorkflow(
    APPLY_LOYALTY_ON_CART_WORKFLOW_ID,
    (input: ApplyLoyaltyOnCartWorkflowInput) => {
        const { data: carts } = useQueryGraphStep({
            entity: "cart", fields, filters: { id: input.cart_id },
            options: { throwIfKeyNotFound: true },
        });

        validateCustomerExistsStep({
            customer: carts[0].customer,
        } as ValidateCustomerExistsStepInput);

        const lockKeys = transform({ carts }, ({ carts }) => [
            carts[0].id,
            `loyalty-customer-${carts[0].customer!.id}`,
        ]);
        acquireLockStep({ key: lockKeys, timeout: 10, ttl: 30 });

        getCartLoyaltyPromoStep({
            cart: carts[0] as unknown as CartData,
            throwErrorOn: "found",
        });

        const loyaltyAmountInput = transform({ carts }, ({ carts }) => ({
            cart: {
                id: carts[0].id,
                customer: carts[0].customer,
                promotions: carts[0].promotions,
                total: carts[0].total,
                points: input.points,
            },
        }));
        const amount = getCartLoyaltyPromoAmountStep(
            loyaltyAmountInput as unknown as GetCartLoyaltyPromoAmountStepInput,
        );

        const promoToCreate = transform(
            {
                carts,
                amount,
            },
            (data) => {
                const randomStr = Math.random().toString(36).substring(2, 8);
                const uniqueId = (
                    "LOYALTY-" +
                    data.carts[0].customer?.first_name +
                    "-" +
                    randomStr
                ).toUpperCase();
                return {
                    code: uniqueId,
                    type: "standard",
                    status: "active",
                    application_method: {
                        type: "fixed",
                        value: data.amount,
                        target_type: "order",
                        currency_code: data.carts[0].currency_code,
                        allocation: "across",
                    },
                    rules: [
                        {
                            attribute: CUSTOMER_ID_PROMOTION_RULE_ATTRIBUTE,
                            operator: "eq",
                            values: [data.carts[0].customer!.id],
                        },
                    ],
                    campaign: {
                        name: uniqueId,
                        description:
                            "Loyalty points promotion for " + data.carts[0].customer!.email,
                        campaign_identifier: uniqueId,
                        budget: {
                            type: "usage",
                            limit: 1,
                        },
                    },
                };
            },
        );

        const loyaltyPromo = createPromotionsStep([promoToCreate] as CreatePromotionDTO[]);

        const reservationInput = transform({ carts, loyaltyPromo }, ({ carts, loyaltyPromo }) => ({
            customer_id: carts[0].customer!.id,
            cart_id: carts[0].id,
            promotion_id: loyaltyPromo[0].id,
            points: input.points,
        }));
        reserveLoyaltyReservationStep(reservationInput);

        const updatePromoData = transform(
            {
                carts,
                promoToCreate,
                loyaltyPromo,
            },
            (data) => {
                const promos = [
                    ...((data.carts[0].promotions?.map((promo) => promo?.code).filter(Boolean) ||
                        []) as string[]),
                    data.promoToCreate.code,
                ];

                return {
                    cart_id: data.carts[0].id,
                    promo_codes: promos,
                    action: PromotionActions.ADD,
                    metadata: {
                        loyalty_promo_id: data.loyaltyPromo[0].id,
                    },
                };
            },
        );

        updateCartPromotionsWorkflow.runAsStep({
            input: updatePromoData,
        });

        updateCartsStep([
            {
                id: input.cart_id,
                metadata: updatePromoData.metadata,
            },
        ]);

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
