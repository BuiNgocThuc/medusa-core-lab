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

    it("consumes points once per cart and does not deduct them again on retry", async () => {
        const service = Object.create(LoyaltyModuleService.prototype) as any
        service.listLoyaltyTransactions = jest
            .fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: "lt_1", status: "consumed" }])
        service.deductPoints = jest.fn().mockResolvedValue(undefined)
        service.createLoyaltyTransactions = jest.fn().mockResolvedValue({ id: "lt_1" })

        await expect(service.consumePointsForCart({
            customer_id: "cus_1",
            cart_id: "cart_1",
            points: 100,
            promotion_id: "promo_1",
        })).resolves.toMatchObject({ consumed: true })
        await expect(service.consumePointsForCart({
            customer_id: "cus_1",
            cart_id: "cart_1",
            points: 100,
            promotion_id: "promo_1",
        })).resolves.toMatchObject({ consumed: false })

        expect(service.deductPoints).toHaveBeenCalledTimes(1)
    })

    it("restores points when checkout compensation reverses a consumed redemption", async () => {
        const service = Object.create(LoyaltyModuleService.prototype) as any
        service.listLoyaltyTransactions = jest.fn().mockResolvedValue([{ id: "lt_1", status: "consumed" }])
        service.addPoints = jest.fn().mockResolvedValue(undefined)
        service.updateLoyaltyTransactions = jest.fn().mockResolvedValue({ id: "lt_1", status: "reversed" })

        await service.reverseCartPointConsumption("cart_1", "cus_1", 100)

        expect(service.addPoints).toHaveBeenCalledWith("cus_1", 100)
        expect(service.updateLoyaltyTransactions).toHaveBeenCalledWith({
            id: "lt_1",
            status: "reversed",
        })
    })
})
