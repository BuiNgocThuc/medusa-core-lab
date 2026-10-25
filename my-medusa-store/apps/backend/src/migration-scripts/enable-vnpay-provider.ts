import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"

const VNPAY_PROVIDER_ID = "pp_vnpay_default"
const MOMO_PROVIDER_ID = "pp_momo_default"
const BANK_TRANSFER_PROVIDER_ID = "pp_bank-transfer_default"
const DEFAULT_PROVIDER_ID = "pp_system_default"
const REQUIRED_VNPAY_ENV = [
  "VNPAY_TMN_CODE",
  "VNPAY_HASH_SECRET",
  "VNPAY_RETURN_URL",
]

export default async function enableVnpayProvider({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const regionModule = container.resolve(Modules.REGION)
  const missingEnv = REQUIRED_VNPAY_ENV.filter((key) => !process.env[key])
  const paymentProviders = [
    DEFAULT_PROVIDER_ID,
    BANK_TRANSFER_PROVIDER_ID,
    ...(process.env.MOMO_PARTNER_CODE &&
    process.env.MOMO_ACCESS_KEY &&
    process.env.MOMO_SECRET_KEY &&
    process.env.MOMO_REDIRECT_URL &&
    process.env.MOMO_IPN_URL
      ? [MOMO_PROVIDER_ID]
      : []),
    VNPAY_PROVIDER_ID,
  ]

  if (missingEnv.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      [
        `[vnpay] ${VNPAY_PROVIDER_ID} is not registered because VNPay env is incomplete.`,
        `Missing: ${missingEnv.join(", ")}`,
        "Add the missing variables to apps/backend/.env, restart the Medusa command, then run this script again.",
      ].join(" ")
    )
  }

  const regions = await regionModule.listRegions({
    currency_code: "vnd",
  })

  if (!regions.length) {
    logger.warn("[vnpay] No VND region found. Skipping provider link.")
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
            payment_providers: paymentProviders,
          },
        },
      })
    )
  )

  logger.info(`[vnpay] Enabled ${VNPAY_PROVIDER_ID} for ${regions.length} VND region(s).`)
}
