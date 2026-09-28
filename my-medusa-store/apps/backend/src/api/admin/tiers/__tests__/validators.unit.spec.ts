import { CreateTierSchema } from "../validators"
import { UpdateTierSchema } from "../[id]/validators"

const validTier = {
  name: "Silver",
  promo_id: null,
  tier_rules: [{ min_purchase_value: 2_000_000, currency_code: "vnd" }],
}

describe("tier API validators", () => {
  it("accepts a valid create or update payload", () => {
    expect(CreateTierSchema.parse(validTier)).toEqual(validTier)
    expect(UpdateTierSchema.parse(validTier)).toEqual(validTier)
  })

  it.each([
    { ...validTier, name: " " },
    { ...validTier, tier_rules: [] },
    { ...validTier, tier_rules: [{ min_purchase_value: -1, currency_code: "vnd" }] },
    { ...validTier, tier_rules: [{ min_purchase_value: 0, currency_code: "vn" }] },
  ])("rejects invalid tier input", (input) => {
    expect(() => CreateTierSchema.parse(input)).toThrow()
  })
})
