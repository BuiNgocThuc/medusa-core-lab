import { isFlashScheduleOpen } from "../schedule"

const schedule = {
  id: "flash_1",
  status: "active" as const,
  timezone: "Asia/Ho_Chi_Minh",
  start_time: "16:00",
  end_time: "18:00",
  weekdays: [4],
  max_discount_amount: 300000,
}

describe("isFlashScheduleOpen", () => {
  it("uses a half-open local time range", () => {
    expect(isFlashScheduleOpen(schedule, new Date("2026-10-01T09:00:00.000Z"))).toBe(true)
    expect(isFlashScheduleOpen(schedule, new Date("2026-10-01T11:00:00.000Z"))).toBe(false)
  })

  it("requires the selected local weekday and active status", () => {
    expect(isFlashScheduleOpen(schedule, new Date("2026-10-02T09:00:00.000Z"))).toBe(false)
    expect(isFlashScheduleOpen({ ...schedule, status: "inactive" }, new Date("2026-10-01T09:00:00.000Z"))).toBe(false)
  })
})
