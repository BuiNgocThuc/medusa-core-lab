import LoyaltyModuleService from "../service"

describe("LoyaltyModuleService conversion policy", () => {
    const loyalty = Object.create(LoyaltyModuleService.prototype) as LoyaltyModuleService

    it("earns one point for every 10,000 VND", async () => {
        await expect(loyalty.calculatePointsFromAmount(29_999)).resolves.toBe(2)
        await expect(loyalty.calculatePointsFromAmount(30_000)).resolves.toBe(3)
    })

    it("redeems one point for every 500 VND", async () => {
        await expect(loyalty.calculateDiscountAmountFromPoints(10)).resolves.toBe(5_000)
        await expect(loyalty.calculatePointsFromDiscountAmount(5_000)).resolves.toBe(10)
    })

    it("rejects an invalid redemption amount", async () => {
        await expect(loyalty.calculatePointsFromDiscountAmount(5_100)).rejects.toThrow(
            "divisible by the point value",
        )
    })

})
