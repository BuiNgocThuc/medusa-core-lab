import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { HELLO_MODULE } from "../../../modules/hello"
import HelloModuleService from "../../../modules/hello/service"

export type CreateCartCustomStepInput = {
  custom_name: string
}

/**
 * Step 1: Tạo bản ghi Custom trong Hello module.
 *
 * Compensation: Nếu workflow bị rollback (ví dụ link tạo thất bại),
 * bản ghi Custom sẽ bị xóa để tránh orphan data.
 */
export const createCartCustomStep = createStep(
  "create-cart-custom",
  async (input: CreateCartCustomStepInput, { container }) => {
    const helloModuleService = container.resolve<HelloModuleService>(HELLO_MODULE)

    const custom = await helloModuleService.createCustoms({
      custom_name: input.custom_name,
    })

    return new StepResponse(custom, custom.id)
  },
  // Compensation: rollback khi step sau thất bại
  async (customId: string, { container }) => {
    if (!customId) return

    const helloModuleService = container.resolve<HelloModuleService>(HELLO_MODULE)
    await helloModuleService.deleteCustoms(customId)
  }
)
