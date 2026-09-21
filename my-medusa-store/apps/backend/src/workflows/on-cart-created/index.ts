import {
  createWorkflow,
  transform,
  WorkflowData,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createCartCustomStep } from "./steps/create-cart-custom"
import { createCartCustomLinkStep } from "./steps/create-cart-custom-link"

export type OnCartCreatedWorkflowInput = {
  cart_id: string
  custom_name?: string
}

export const onCartCreatedWorkflowId = "on-cart-created"

/**
 * Workflow được gọi từ hook `cartCreated` của `createCartWorkflow`.
 *
 * Đảm bảo tính toàn vẹn dữ liệu thông qua compensation:
 * - Nếu bước tạo link thất bại → bản ghi Custom được rollback tự động.
 *
 * Steps:
 *   1. createCartCustomStep    → tạo bản ghi trong Hello module
 *   2. createCartCustomLinkStep → liên kết Cart ↔ Custom
 */
export const onCartCreatedWorkflow = createWorkflow(
  onCartCreatedWorkflowId,
  (input: WorkflowData<OnCartCreatedWorkflowInput>) => {
    // Step 1: Tạo Custom record
    const custom = createCartCustomStep({
      custom_name: transform({ input }, ({ input }) =>
        input.custom_name ?? "default"
      ),
    })

    // Step 2: Tạo link — nếu fail, Step 1 tự động rollback
    createCartCustomLinkStep(
      transform({ input, custom }, ({ input, custom }) => ({
        cart_id: input.cart_id,
        custom_id: custom.id,
      }))
    )

    return new WorkflowResponse(void 0)
  }
)
