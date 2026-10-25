import { isEligibleForFirstPurchasePromotion } from "../eligibility"

describe("first-purchase eligibility", () => {
  const activePromotion = { status: "active" }

  it("allows a registered customer with no orders", () => {
    expect(isEligibleForFirstPurchasePromotion(
      { has_account: true, orders: [] },
      activePromotion,
      false,
    )).toBe(true)
  })

  it.each([
    [{ has_account: false, orders: [] }, activePromotion, false],
    [{ has_account: true, orders: [{}] }, activePromotion, false],
    [{ has_account: true, orders: [] }, { status: "inactive" }, false],
    [{ has_account: true, orders: [] }, activePromotion, true],
  ])("rejects an ineligible cart", (customer, promotion, isAlreadyApplied) => {
    expect(isEligibleForFirstPurchasePromotion(customer, promotion, isAlreadyApplied)).toBe(false)
  })
})
