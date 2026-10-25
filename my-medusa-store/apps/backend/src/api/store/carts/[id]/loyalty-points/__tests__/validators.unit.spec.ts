import { RedeemLoyaltyPointsSchema } from "../validators"

describe("RedeemLoyaltyPointsSchema", () => {
    it("accepts positive whole points", () => {
        expect(RedeemLoyaltyPointsSchema.parse({ points: 200 })).toEqual({ points: 200 })
        expect(RedeemLoyaltyPointsSchema.parse({ points: 150 })).toEqual({ points: 150 })
    })

    it("rejects fractions and zero", () => {
        expect(() => RedeemLoyaltyPointsSchema.parse({ points: 1.5 })).toThrow()
        expect(() => RedeemLoyaltyPointsSchema.parse({ points: 0 })).toThrow()
    })
})
