import type { MedusaContainer } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

const CAMPAIGN = {
  name: "Demo Commerce Campaign",
  campaign_identifier: "demo-commerce-campaign",
  description: "Reusable seed campaign for local commerce demos",
  starts_at: new Date("2026-01-01T00:00:00.000Z"),
}

const PROMOTIONS = [
  { code: "WELCOME10", value: 10, campaign: false },
  { code: "SUMMER15", value: 15, campaign: true },
] as const

export async function seedMarketing(container: MedusaContainer) {
  const promotionModule = container.resolve(Modules.PROMOTION) as any
  const [existingCampaign] = await promotionModule.listCampaigns({
    campaign_identifier: CAMPAIGN.campaign_identifier,
  })
  const campaign = existingCampaign ?? await promotionModule.createCampaigns(CAMPAIGN)
  const promotions: any[] = []

  for (const fixture of PROMOTIONS) {
    const [existing] = await promotionModule.listPromotions({ code: fixture.code })
    promotions.push(existing ?? await promotionModule.createPromotions({
      code: fixture.code,
      type: "standard",
      status: "active",
      campaign_id: fixture.campaign ? campaign.id : undefined,
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "across",
        value: fixture.value,
      },
    }))
  }

  return { campaign, promotions }
}
