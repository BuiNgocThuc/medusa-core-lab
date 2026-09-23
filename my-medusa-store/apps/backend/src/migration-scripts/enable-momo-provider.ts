import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"

const MOMO_PROVIDER_ID = "pp_momo_default"
const BANK_TRANSFER_PROVIDER_ID = "pp_bank-transfer_default"
const DEFAULT_PROVIDER_ID = "pp_system_default"
const REQUIRED_MOMO_ENV = [
  "MOMO_PARTNER_CODE",
  "MOMO_ACCESS_KEY",
  "MOMO_SECRET_KEY",
  "MOMO_REDIRECT_URL",
  "MOMO_IPN_URL",
]

export default async function enableMomoProvider({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const regionModule = container.resolve(Modules.REGION)
  const missingEnv = REQUIRED_MOMO_ENV.filter((key) => !process.env[key])

  if (missingEnv.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      [
        `[momo] ${MOMO_PROVIDER_ID} is not registered because MoMo env is incomplete.`,
        `Missing: ${missingEnv.join(", ")}`,
        "Add the missing variables to apps/backend/.env, restart the Medusa command, then run this script again.",
      ].join(" ")
    )
  }

  const regions = await regionModule.listRegions({
    currency_code: "vnd",
  })

  if (!regions.length) {
    logger.warn("[momo] No VND region found. Skipping provider link.")
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
            payment_providers: [
              DEFAULT_PROVIDER_ID,
              BANK_TRANSFER_PROVIDER_ID,
              MOMO_PROVIDER_ID,
            ],
          },
        },
      })
    )
  )

  logger.info(`[momo] Enabled ${MOMO_PROVIDER_ID} for ${regions.length} VND region(s).`)
}
