import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { applyLoyaltyAdjustmentStep } from "./apply-loyalty-on-cart/steps"

type SyncLoyaltyAdjustmentInput = {
  cart_id: string
  promotion_id: string
  points: number
}

export const syncLoyaltyAdjustmentWorkflow = createWorkflow(
  "sync-loyalty-adjustment",
  (input: SyncLoyaltyAdjustmentInput) => {
    const result = applyLoyaltyAdjustmentStep(input)

    return new WorkflowResponse(result)
  },
)
