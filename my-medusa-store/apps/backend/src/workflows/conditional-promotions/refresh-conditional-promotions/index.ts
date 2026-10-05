import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { refreshConditionalPromotionsStep } from "./steps/refresh-conditional-promotions";

export const refreshConditionalPromotionsWorkflow = createWorkflow(
    "refresh-conditional-promotions",
    ({ cart_id }: { cart_id: string }) =>
        new WorkflowResponse(refreshConditionalPromotionsStep({ cart_id })),
);
