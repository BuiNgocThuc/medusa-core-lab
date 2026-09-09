import { getCustomerTier } from "../../constants"

describe("getCustomerTier", () => {
  it.each([
    [1_999_999, "bronze"],
    [2_000_000, "silver"],
    [9_999_999, "silver"],
    [10_000_000, "gold"],
  ] as const)("returns %i VND total spend as %s tier", (spend, expectedTier) => {
    expect(getCustomerTier(spend)).toBe(expectedTier)
  })
})
