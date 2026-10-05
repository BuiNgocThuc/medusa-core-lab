import { Modules } from "@medusajs/framework/utils"
import { PROMOTION_ENTITLEMENT_MODULE } from "@/modules/promotion-entitlement"
import { syncConditionalPromotions } from "../sync"

describe("syncConditionalPromotions", () => {
  it("updates cart metadata with the cart id overload", async () => {
    const updateCarts = jest.fn().mockResolvedValue(undefined)
    const releaseFlashRedemption = jest.fn().mockResolvedValue(undefined)
    const container = {
      resolve: (key: string) => {
        if (key === Modules.CART) return { updateCarts }
        if (key === PROMOTION_ENTITLEMENT_MODULE) {
          return { releaseFlashRedemption }
        }
        throw new Error(`Unexpected container key: ${key}`)
      },
    }

    await syncConditionalPromotions(
      container,
      { debug: jest.fn() },
      {
        id: "cart_1",
        metadata: { tier_promotion_ids: [] },
        promotions: [{ code: "RACKET_SUMMER_GET_SOCK" }],
      },
      {
        code: "RACKET_SUMMER_GET_SOCK",
        amount: 100_000,
        priority: 3,
        custom: true,
        promoId: "promo_1",
        configId: "conditional_1",
      },
      new Set(["RACKET_SUMMER_GET_SOCK"]),
    )

    expect(updateCarts).toHaveBeenCalledWith("cart_1", {
      metadata: {
        tier_promotion_ids: [],
        conditional_promotion_ids: ["promo_1"],
        conditional_promotion_config_ids: ["conditional_1"],
      },
    })
  })
})
