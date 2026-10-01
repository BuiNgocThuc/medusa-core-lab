import { selectConditionalPromotion } from "../refresh-conditional-promotions/steps/candidates"

const racketCategoryId = "rackets"
const socksCategoryId = "socks"
const summerCollectionId = "summer"

const config = {
  id: "conditional-summer",
  promo_id: "promotion-summer",
  priority: 3,
  max_quantity: 1,
  rule_tree: {
    version: 1 as const,
    operator: "and" as const,
    conditions: [
      {
        min_quantity: 2,
        match: {
          mode: "all" as const,
          clauses: [{ attribute: "category" as const, values: [racketCategoryId] }],
        },
        subset_requirements: [
          {
            min_quantity: 1,
            match: {
              mode: "all" as const,
              clauses: [{ attribute: "collection" as const, values: [summerCollectionId] }],
            },
          },
        ],
      },
    ],
  },
  target: {
    mode: "all" as const,
    clauses: [{ attribute: "category" as const, values: [socksCategoryId] }],
  },
}

const item = (
  quantity: number,
  unitPrice: number,
  product: Record<string, unknown>,
) => ({ quantity, unit_price: unitPrice, product })

describe("Summer Racket + Socks conditional promotion", () => {
  it("selects RACKET_SUMMER_GET_SOCK when the cart has two rackets, one Summer racket, and socks", () => {
    const selected = selectConditionalPromotion(
      {
        items: [
          item(1, 4_300_000, {
            id: "summer-racket",
            categories: [{ id: racketCategoryId }],
            collection_id: summerCollectionId,
          }),
          item(1, 3_600_000, {
            id: "regular-racket",
            categories: [{ id: racketCategoryId }],
          }),
          item(1, 100_000, {
            id: "socks",
            categories: [{ id: socksCategoryId }],
          }),
        ],
      },
      [config],
      [{ id: "promotion-summer", code: "RACKET_SUMMER_GET_SOCK" }],
    )

    expect(selected).toMatchObject({
      code: "RACKET_SUMMER_GET_SOCK",
      amount: 100_000,
      custom: true,
    })
  })

  it("accepts two units of the same Summer racket variant", () => {
    const selected = selectConditionalPromotion(
      {
        items: [
          item(2, 4_300_000, {
            id: "summer-racket",
            categories: [{ id: racketCategoryId }],
            collection_id: summerCollectionId,
          }),
          item(1, 100_000, {
            id: "socks",
            categories: [{ id: socksCategoryId }],
          }),
        ],
      },
      [config],
      [{ id: "promotion-summer", code: "RACKET_SUMMER_GET_SOCK" }],
    )

    expect(selected?.code).toBe("RACKET_SUMMER_GET_SOCK")
  })

  it("rejects a cart with only one Summer racket", () => {
    const selected = selectConditionalPromotion(
      {
        items: [
          item(1, 4_300_000, {
            id: "summer-racket",
            categories: [{ id: racketCategoryId }],
            collection_id: summerCollectionId,
          }),
          item(1, 100_000, {
            id: "socks",
            categories: [{ id: socksCategoryId }],
          }),
        ],
      },
      [config],
      [{ id: "promotion-summer", code: "RACKET_SUMMER_GET_SOCK" }],
    )

    expect(selected).toBeNull()
  })
})
