import { orderPromotionCodes } from "../promo"

describe("orderPromotionCodes", () => {
    it("places automatic promotions before codes and loyalty last", () => {
        expect(orderPromotionCodes([
            { id: "loyalty", code: "LOYALTY-CART", is_automatic: false },
            { id: "code", code: "WELCOME10", is_automatic: false },
            { id: "automatic", code: "AUTOMATIC20", is_automatic: true },
        ], { loyaltyPromotionId: "loyalty" })).toEqual([
            "AUTOMATIC20",
            "WELCOME10",
            "LOYALTY-CART",
        ])
    })

    it("can mark workflow-created automatic promotions before user-entered codes", () => {
        expect(orderPromotionCodes([
            { id: "code", code: "WELCOME10", is_automatic: false },
            { id: "flash", code: "FLASH20-cart", is_automatic: false },
        ], { automaticCodes: ["FLASH20-cart"] })).toEqual([
            "FLASH20-cart",
            "WELCOME10",
        ])
    })
})
