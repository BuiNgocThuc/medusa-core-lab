import LoyaltyModuleService from "../service"

describe("LoyaltyModuleService conversion policy", () => {
    const loyalty = Object.create(LoyaltyModuleService.prototype) as LoyaltyModuleService

    it("earns one point for every 10,000 VND", async () => {
        await expect(loyalty.calculatePointsFromAmount(29_999)).resolves.toBe(2)
        await expect(loyalty.calculatePointsFromAmount(30_000)).resolves.toBe(3)
    })

    it("redeems only complete 100-point blocks", async () => {
        await expect(loyalty.calculateDiscountAmountFromPoints(299)).resolves.toBe(40_000)
        await expect(loyalty.calculatePointsFromDiscountAmount(40_000)).resolves.toBe(200)
    })

    it("rejects an invalid redemption amount", async () => {
        await expect(loyalty.calculatePointsFromDiscountAmount(10_000)).rejects.toThrow(
            "valid redemption block",
        )
    })
})
