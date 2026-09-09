import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { CUSTOMER_TIERS, FIRST_PURCHASE_PROMOTION_CODE } from "../constants"

const TIER_PROMOTIONS = [
  { tier: "silver", code: "TIER_SILVER", value: 5 },
  { tier: "gold", code: "TIER_GOLD", value: 10 },
] as const

export default async function setupPromotions({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const customerModule = container.resolve(Modules.CUSTOMER) as any
  const promotionModule = container.resolve(Modules.PROMOTION) as any

  const groupsByName = new Map<string, { id: string; name: string }>()
  for (const tier of Object.values(CUSTOMER_TIERS)) {
    const [existing] = await customerModule.listCustomerGroups({ name: tier.name })
    const group = existing ?? await customerModule.createCustomerGroups({ name: tier.name })
    groupsByName.set(tier.name, group)
  }

  const promotionDefinitions = [
    {
      code: FIRST_PURCHASE_PROMOTION_CODE,
      type: "standard",
      status: "active",
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "across",
        value: 10,
      },
    },
    ...TIER_PROMOTIONS.map(({ tier, code, value }) => ({
      code,
      type: "standard",
      status: "active",
      is_automatic: true,
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "across",
        value,
      },
      rules: [{
        attribute: "customer.groups.id",
        operator: "eq",
        values: [groupsByName.get(CUSTOMER_TIERS[tier].name)!.id],
      }],
    })),
  ]

  for (const definition of promotionDefinitions) {
    const [existing] = await promotionModule.listPromotions({ code: definition.code })
    if (!existing) {
      await promotionModule.createPromotions(definition)
      logger.info(`[promotions] created ${definition.code}`)
    }
  }

  logger.info("[promotions] customer tiers and promotions are ready")
}
