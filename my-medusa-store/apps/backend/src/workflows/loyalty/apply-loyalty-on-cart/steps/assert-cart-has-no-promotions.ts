import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export const assertCartHasNoPromotionsStep = createStep(
  "assert-cart-has-no-promotions",
  async ({ promotions }: { promotions?: unknown[] }) => {
    if (promotions?.length) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Không thể đổi điểm khi giỏ hàng đang có ưu đãi.")
    return new StepResponse(true)
  },
)
