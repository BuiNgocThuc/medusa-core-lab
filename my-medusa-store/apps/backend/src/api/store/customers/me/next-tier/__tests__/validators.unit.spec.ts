import { NextTierSchema } from "../validators"

describe("next-tier API validator", () => {
  it("requires a region id", () => {
    expect(NextTierSchema.parse({ region_id: "reg_01" })).toEqual({ region_id: "reg_01" })
    expect(() => NextTierSchema.parse({})).toThrow()
  })
})
