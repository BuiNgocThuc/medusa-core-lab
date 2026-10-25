import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { Link } from "@medusajs/framework/modules-sdk"
import { HELLO_MODULE } from "../../../modules/hello"

export type CreateCartCustomLinkStepInput = {
  cart_id: string
  custom_id: string
}

/**
 * Step 2: Tạo link giữa Cart và Custom record trong Hello module.
 *
 * Compensation: Nếu workflow bị rollback ở bước sau,
 * link sẽ bị xóa để giữ consistency.
 */
export const createCartCustomLinkStep = createStep(
  "create-cart-custom-link",
  async (input: CreateCartCustomLinkStepInput, { container }) => {
    const link = container.resolve<Link>(ContainerRegistrationKeys.LINK)

    await link.create({
      [Modules.CART]: { cart_id: input.cart_id },
      [HELLO_MODULE]: { custom_id: input.custom_id },
    })

    return new StepResponse(void 0, input)
  },
  // Compensation: xóa link nếu workflow rollback
  async (input: CreateCartCustomLinkStepInput, { container }) => {
    if (!input) return

    const link = container.resolve<Link>(ContainerRegistrationKeys.LINK)
    await link.dismiss({
      [Modules.CART]: { cart_id: input.cart_id },
      [HELLO_MODULE]: { custom_id: input.custom_id },
    })
  }
)
