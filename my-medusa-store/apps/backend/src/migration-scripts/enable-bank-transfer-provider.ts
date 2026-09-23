import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"

const BANK_TRANSFER_PROVIDER_ID = "pp_bank-transfer_default"
const DEFAULT_PROVIDER_ID = "pp_system_default"

export default async function enableBankTransferProvider({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const regionModule = container.resolve(Modules.REGION)

  const regions = await regionModule.listRegions({
    currency_code: "vnd",
  })

  if (!regions.length) {
    logger.warn("[bank-transfer] No VND region found. Skipping provider link.")
    return
  }

  await Promise.all(
    regions.map((region) =>
      updateRegionsWorkflow(container).run({
        input: {
          selector: {
            id: region.id,
          },
          update: {
            payment_providers: [DEFAULT_PROVIDER_ID, BANK_TRANSFER_PROVIDER_ID],
          },
        },
      })
    )
  )

  logger.info(
    `[bank-transfer] Enabled ${BANK_TRANSFER_PROVIDER_ID} for ${regions.length} VND region(s).`
  )
}
