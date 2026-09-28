const earnRun = jest.fn()
const redeemRun = jest.fn()

jest.mock("@/src/workflows", () => ({
  earnLoyaltyOnOrderWorkflow: jest.fn(() => ({ run: earnRun })),
  handleOrderRedemptionWorkflow: jest.fn(() => ({ run: redeemRun })),
}))

import handleLoyaltyPoints from "../handle-loyalty-points"

describe("handle loyalty points subscriber", () => {
  const logger = { error: jest.fn(), info: jest.fn() }
  const container = {
    resolve: jest.fn(() => logger),
  } as any

  beforeEach(() => {
    jest.clearAllMocks()
    earnRun.mockResolvedValue({
      result: { earned_points: 304, skipped: false },
    })
    redeemRun.mockResolvedValue({})
  })

  it("earns and redeems loyalty independently", async () => {
    await handleLoyaltyPoints({
      event: { data: { id: "order_01" } },
      container,
    } as any)

    expect(earnRun).toHaveBeenCalledWith({ input: { order_id: "order_01" } })
    expect(logger.info).toHaveBeenCalledWith(
      "Loyalty subscriber action successfully completed for order order_01: 304 point(s)",
    )
    expect(redeemRun).toHaveBeenCalledWith({ input: { order_id: "order_01" } })
  })

  it("still attempts redemption when earning fails", async () => {
    earnRun.mockRejectedValue(new Error("earning failed"))

    await handleLoyaltyPoints({
      event: { data: { id: "order_01" } },
      container,
    } as any)

    expect(logger.error).toHaveBeenCalledWith(
      "Error earning loyalty points for order order_01:",
      expect.any(Error),
    )
    expect(redeemRun).toHaveBeenCalledWith({ input: { order_id: "order_01" } })
  })
})
