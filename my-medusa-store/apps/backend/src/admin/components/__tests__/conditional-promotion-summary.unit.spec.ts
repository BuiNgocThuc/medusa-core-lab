import { conditionalPromotionSummary } from "../conditional-promotion-summary"

describe("conditionalPromotionSummary", () => {
  it("describes the Racket Summer Get Sock rule in Vietnamese", () => {
    const summary = conditionalPromotionSummary({
      ruleTree: {
        conditions: [{
          min_quantity: 2,
          match: { mode: "all", clauses: [{ attribute: "category", values: ["rackets"] }] },
          subset_requirements: [{
            min_quantity: 1,
            match: { mode: "all", clauses: [{ attribute: "collection", values: ["summer"] }] },
          }],
        }],
      },
      target: { mode: "all", clauses: [{ attribute: "category", values: ["socks"] }] },
      percentage: 100,
      maxQuantity: 1,
      options: {
        category: [{ id: "rackets", name: "Rackets" }, { id: "socks", name: "Socks" }],
        collection: [{ id: "summer", title: "Summer" }],
      },
    })

    expect(summary.eligibility).toBe("Automatically applies when the cart contains at least 2 items in category “Rackets”, including at least 1 item in collection “Summer”.")
    expect(summary.benefit).toBe("Benefit: 100% off up to 1 item in category “Socks”.")
  })
})
