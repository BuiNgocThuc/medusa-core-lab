import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  CONDITIONAL_PROMOTION_MODULE,
  ConditionalPromotionModuleService,
} from "../modules/conditional-promotion"
import { nativeTargetRules } from "../api/admin/conditional-promotions/target-rules"

type Matcher = {
  mode: "all" | "any"
  clauses: Array<{
    attribute: "product" | "category" | "collection" | "tag" | "type"
    values: string[]
  }>
}

type DemoFixture = {
  code: string
  title: string
  description: string
  percentage: number
  maxQuantity: number
  priority: number
  ruleTree: {
    version: 1
    operator: "and"
    conditions: Array<{
      min_quantity: number
      match: Matcher
      subset_requirements?: Array<{ min_quantity: number; match: Matcher }>
    }>
  }
  target: Matcher
  placements: { category_ids: string[]; collection_ids: string[] }
}

async function categoryIds(query: any) {
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "name"],
  })
  const ids = Object.fromEntries(data.map((category: any) => [category.name, category.id]))
  if (!ids.Rackets || !ids.Shoes || !ids.Socks) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Conditional promotion demos require Rackets, Shoes, and Socks categories",
    )
  }
  return ids as Record<"Rackets" | "Shoes" | "Socks", string>
}

async function summerCollectionId(query: any) {
  const { data } = await query.graph({
    entity: "product_collection",
    fields: ["id"],
    filters: { handle: "summer" },
  })
  if (!data[0]?.id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Conditional promotion demos require the summer collection",
    )
  }
  return data[0].id as string
}

function demoFixtures(ids: Record<"Rackets" | "Shoes" | "Socks", string>, summerId: string): DemoFixture[] {
  const socksTarget: Matcher = {
    mode: "all",
    clauses: [{ attribute: "category", values: [ids.Socks] }],
  }

  return [
    {
      code: "DEMO_TWO_RACKETS_25",
      title: "Demo: Two Rackets",
      description: "25% off one Socks item when the cart contains two Rackets.",
      percentage: 25,
      maxQuantity: 1,
      priority: 10,
      ruleTree: {
        version: 1,
        operator: "and",
        conditions: [{
          min_quantity: 2,
          match: { mode: "all", clauses: [{ attribute: "category", values: [ids.Rackets] }] },
        }],
      },
      target: socksTarget,
      placements: { category_ids: [ids.Rackets], collection_ids: [] },
    },
    {
      code: "DEMO_SUMMER_RACKET_50",
      title: "Demo: Summer Racket",
      description: "50% off one Socks item when a Summer Racket is in the cart.",
      percentage: 50,
      maxQuantity: 1,
      priority: 20,
      ruleTree: {
        version: 1,
        operator: "and",
        conditions: [{
          min_quantity: 1,
          match: { mode: "all", clauses: [{ attribute: "category", values: [ids.Rackets] }] },
          subset_requirements: [{
            min_quantity: 1,
            match: { mode: "all", clauses: [{ attribute: "collection", values: [summerId] }] },
          }],
        }],
      },
      target: socksTarget,
      placements: { category_ids: [ids.Rackets], collection_ids: [summerId] },
    },
    {
      code: "DEMO_RACKET_OR_SHOES_15",
      title: "Demo: Racket or Shoes",
      description: "15% off one Socks item when the cart contains two Rackets or Shoes.",
      percentage: 15,
      maxQuantity: 1,
      priority: 5,
      ruleTree: {
        version: 1,
        operator: "and",
        conditions: [{
          min_quantity: 2,
          match: {
            mode: "any",
            clauses: [
              { attribute: "category", values: [ids.Rackets] },
              { attribute: "category", values: [ids.Shoes] },
            ],
          },
        }],
      },
      target: socksTarget,
      placements: { category_ids: [ids.Rackets, ids.Shoes], collection_ids: [] },
    },
    {
      code: "DEMO_SHOES_AND_SOCKS_10",
      title: "Demo: Shoes and Socks",
      description: "10% off one Racket when the cart contains Shoes and Socks.",
      percentage: 10,
      maxQuantity: 1,
      priority: 1,
      ruleTree: {
        version: 1,
        operator: "and",
        conditions: [
          {
            min_quantity: 1,
            match: { mode: "all", clauses: [{ attribute: "category", values: [ids.Shoes] }] },
          },
          {
            min_quantity: 1,
            match: { mode: "all", clauses: [{ attribute: "category", values: [ids.Socks] }] },
          },
        ],
      },
      target: { mode: "all", clauses: [{ attribute: "category", values: [ids.Rackets] }] },
      placements: { category_ids: [ids.Shoes, ids.Socks], collection_ids: [] },
    },
  ]
}

async function syncFixture(
  fixture: DemoFixture,
  promotionService: any,
  conditionalService: ConditionalPromotionModuleService,
  logger: { info: (message: string) => void },
) {
  const [existingPromotion] = await promotionService.listPromotions({ code: fixture.code }, {
    relations: ["application_method.target_rules"],
  })
  const promotionData = {
    code: fixture.code,
    type: "standard" as const,
    status: "inactive" as const,
    is_automatic: false,
    application_method: {
      type: "percentage",
      value: fixture.percentage,
      target_type: "items",
      allocation: "once",
      max_quantity: fixture.maxQuantity,
    },
    metadata: { source: "conditional-promotion-engine", seed: "conditional-promotion-demo" },
  }

  const promotion = existingPromotion
    ? await promotionService.updatePromotions({ id: existingPromotion.id, ...promotionData })
    : await promotionService.createPromotions(promotionData)
  const targetRuleIds = existingPromotion?.application_method?.target_rules?.map(
    (rule: any) => rule.id,
  ) ?? []
  if (targetRuleIds.length) {
    await promotionService.removePromotionTargetRules(promotion.id, targetRuleIds)
  }
  await promotionService.addPromotionTargetRules(promotion.id, nativeTargetRules(fixture.target as any))

  const configData = {
    promo_id: promotion.id,
    title: fixture.title,
    description: fixture.description,
    terms: "Demo fixture. Activate only when testing this rule.",
    cta_url: null,
    status: "inactive" as const,
    priority: fixture.priority,
    rule_tree: fixture.ruleTree,
    target: fixture.target,
    max_quantity: fixture.maxQuantity,
    placements: fixture.placements,
  }
  const [existingConfig] = await conditionalService.listConditionalPromotions({ promo_id: promotion.id })
  if (existingConfig) {
    await conditionalService.updateConditionalPromotions({ id: existingConfig.id, ...configData } as any)
  } else {
    await conditionalService.createConditionalPromotions(configData as any)
  }
  logger.info(`[seed:conditional-promotions] synchronized ${fixture.code}`)
}

export default async function seedConditionalPromotions({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as { info: (message: string) => void }
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const promotionService = container.resolve(Modules.PROMOTION) as any
  const conditionalService = container.resolve(
    CONDITIONAL_PROMOTION_MODULE,
  ) as ConditionalPromotionModuleService
  const ids = await categoryIds(query)
  const summerId = await summerCollectionId(query)

  for (const fixture of demoFixtures(ids, summerId)) {
    await syncFixture(fixture, promotionService, conditionalService, logger)
  }
}
