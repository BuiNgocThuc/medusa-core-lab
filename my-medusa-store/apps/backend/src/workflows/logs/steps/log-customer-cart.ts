import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const logCustomerCartStep = createStep(
  "log-customer-cart",
  async (data: Record<string, unknown>, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    logger.info(`customer cart query result: ${JSON.stringify(data, null, 2)}`)
    return new StepResponse(data)
  }
)