import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"
import { TIER_MODULE } from "../modules/tier"

const PASSWORD = "supersecret"
const TIER_FIXTURES = [
  {
    name: "Bronze",
    email: "conghung@gmail.com",
    firstName: "Cong",
    minimumSpend: 0,
    promotion: null,
  },
  {
    name: "Silver",
    email: "ngocthuc@gmail.com",
    firstName: "Ngoc",
    minimumSpend: 2_000_000,
    promotion: { code: "TIER_TEST_SILVER", value: 5 },
  },
  {
    name: "Gold",
    email: "congson@gmail.com",
    firstName: "Cong",
    minimumSpend: 10_000_000,
    promotion: { code: "TIER_TEST_GOLD", value: 10 },
  },
] as const

async function ensureCustomer(
  container: ExecArgs["container"],
  email: string,
  firstName: string
) {
  const customerModule = container.resolve(Modules.CUSTOMER) as any
  const authModule = container.resolve(Modules.AUTH) as any
  const [existing] = await customerModule.listCustomers({ email })

  if (existing?.has_account) {
    return existing
  }

  const registration = await authModule.register("emailpass", {
    body: { email, password: PASSWORD },
  })
  if (!registration.success || !registration.authIdentity) {
    throw new Error(`Could not create auth identity for ${email}: ${registration.error}`)
  }

  const { result: customer } = await createCustomerAccountWorkflow(container).run({
    input: {
      authIdentityId: registration.authIdentity.id,
      customerData: {
        email,
        first_name: firstName,
        last_name: "Tier Test",
      },
    },
  })

  return customer
}

export default async function seedCustomerTiers({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const promotionModule = container.resolve(Modules.PROMOTION) as any
  const tierModule = container.resolve(TIER_MODULE) as any
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const link = container.resolve(ContainerRegistrationKeys.LINK) as any

  for (const fixture of TIER_FIXTURES) {
    let promotion: { id: string } | null = null
    if (fixture.promotion) {
      const [existingPromotion] = await promotionModule.listPromotions({
        code: fixture.promotion.code,
      })
      promotion = existingPromotion ?? await promotionModule.createPromotions({
        code: fixture.promotion.code,
        type: "standard",
        status: "active",
        application_method: {
          type: "percentage",
          target_type: "items",
          allocation: "across",
          value: fixture.promotion.value,
        },
      })
    }

    const [existingTier] = await tierModule.listTiers({ name: fixture.name })
    const tier = existingTier
      ? await tierModule.updateTiers({
          id: existingTier.id,
          promo_id: promotion?.id ?? null,
        })
      : await tierModule.createTiers({
          name: fixture.name,
          promo_id: promotion?.id ?? null,
        })

    const [existingRule] = await tierModule.listTierRules({
      tier_id: tier.id,
      currency_code: "vnd",
    })
    if (!existingRule) {
      await tierModule.createTierRules({
        tier_id: tier.id,
        currency_code: "vnd",
        min_purchase_value: fixture.minimumSpend,
      })
    }

    const customer = await ensureCustomer(container, fixture.email, fixture.firstName)
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id", "tier.id"],
      filters: { id: customer.id },
    })
    const currentTierId = customers[0]?.tier?.id
    if (currentTierId !== tier.id) {
      if (currentTierId) {
        await link.dismiss([
          {
            [TIER_MODULE]: { tier_id: currentTierId },
            [Modules.CUSTOMER]: { customer_id: customer.id },
          },
        ])
      }

      await link.create([
        {
          [TIER_MODULE]: { tier_id: tier.id },
          [Modules.CUSTOMER]: { customer_id: customer.id },
        },
      ])
    }

    logger.info(`[seed:tiers] ${fixture.name} ready for ${fixture.email}`)
  }

  logger.info(`[seed:tiers] done. Test password for all tier users: ${PASSWORD}`)
}
