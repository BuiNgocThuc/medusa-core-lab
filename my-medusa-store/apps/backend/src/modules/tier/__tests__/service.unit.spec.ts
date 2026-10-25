import TierModuleService from "../service"

describe("TierModuleService", () => {
  const service = Object.create(TierModuleService.prototype) as TierModuleService

  beforeEach(() => {
    ;(service as any).listTierRules = jest.fn().mockResolvedValue([
      { min_purchase_value: 0, tier: { id: "bronze", name: "Bronze" } },
      { min_purchase_value: 2_000_000, tier: { id: "silver", name: "Silver" } },
      { min_purchase_value: 10_000_000, tier: { id: "gold", name: "Gold" } },
    ]) as any
  })

  it("finds the highest qualifying tier", async () => {
    await expect(service.calculateQualifyingTier("vnd", 2_500_000)).resolves.toBe("silver")
  })

  it("returns the next tier and missing purchase value", async () => {
    await expect(service.calculateNextTierUpgrade("vnd", 2_500_000)).resolves.toMatchObject({
      tier: { id: "gold" },
      required_amount: 7_500_000,
    })
  })
})
