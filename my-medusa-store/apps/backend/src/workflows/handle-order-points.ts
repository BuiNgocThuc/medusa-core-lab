import { createWorkflow, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { updatePromotionsStep, useQueryGraphStep } from "@medusajs/medusa/core-flows";
import {
    getCartLoyaltyPromoStep,
    validateCustomerExistsStep,
    ValidateCustomerExistsStepInput,
    deductPurchasePointsStep,
    addPurchaseAsPointsStep,
} from "@/src/workflows/steps";
import { CartData, OrderData, orderHasLoyaltyPromotion } from "@/src/utils";

type WorkflowInput = {
    order_id: string;
};

export const handleOrderPointsWorkflow = createWorkflow(
    "handle-order-points",
    ({ order_id }: WorkflowInput) => {
        const { data: orders } = useQueryGraphStep({
            entity: "order",
            fields: [
                "id",
                "customer.*",
                "total",
                "cart.*",
                "cart.promotions.*",
                "cart.promotions.rules.*",
                "cart.promotions.rules.values.*",
                "cart.promotions.application_method.*",
            ],
            filters: {
                id: order_id,
            },
            options: {
                throwIfKeyNotFound: true,
            },
        });

        validateCustomerExistsStep({
            customer: orders[0].customer,
        } as ValidateCustomerExistsStepInput);

        const loyaltyPointsPromotion = getCartLoyaltyPromoStep({
            cart: orders[0].cart as unknown as CartData,
        });

        when(
            orders,
            (orders) =>
                orderHasLoyaltyPromotion(orders[0] as unknown as OrderData) &&
                loyaltyPointsPromotion !== undefined,
        ).then(() => {
            deductPurchasePointsStep({
                customer_id: orders[0].customer!.id,
                amount: loyaltyPointsPromotion.application_method!.value as number,
            });

            updatePromotionsStep([
                {
                    id: loyaltyPointsPromotion.id,
                    status: "inactive",
                },
            ]);
        });

        when(orders, (order) => !orderHasLoyaltyPromotion(order[0] as unknown as OrderData)).then(
            () => {
                addPurchaseAsPointsStep({
                    customer_id: orders[0].customer!.id,
                    amount: orders[0].total,
                });
            },
        );

        return new WorkflowResponse({
            order_id,
        });
    },
);
