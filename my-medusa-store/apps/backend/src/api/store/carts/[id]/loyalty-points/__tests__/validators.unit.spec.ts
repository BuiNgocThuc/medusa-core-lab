import { RedeemLoyaltyPointsSchema } from "../validators"

describe("RedeemLoyaltyPointsSchema", () => {
    it("accepts complete redemption blocks", () => {
        expect(RedeemLoyaltyPointsSchema.parse({ points: 200 })).toEqual({ points: 200 })
    })

    it("rejects fractions and incomplete blocks", () => {
        expect(() => RedeemLoyaltyPointsSchema.parse({ points: 150 })).toThrow()
        expect(() => RedeemLoyaltyPointsSchema.parse({ points: 0 })).toThrow()
    })
})
