export type FlashSchedule = {
  id: string
  status: "active" | "inactive" | "scheduled" | "due"
  timezone: string
  start_time: string
  end_time: string
  weekdays: number[]
  max_discount_amount: number
}

function timeParts(now: Date, timezone: string) {
  const values = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hourCycle: "h23", weekday: "short", hour: "2-digit", minute: "2-digit" }).formatToParts(now)
  const get = (type: string) => values.find((part) => part.type === type)?.value ?? ""
  return { weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")), time: `${get("hour")}:${get("minute")}` }
}

export function isFlashScheduleOpen(schedule: FlashSchedule, now = new Date()) {
  if (schedule.status === "inactive" || schedule.status === "due") return false
  try {
    const { weekday, time } = timeParts(now, schedule.timezone)
    return schedule.weekdays.includes(weekday) && time >= schedule.start_time && time < schedule.end_time
  } catch { return false }
}

export function flashScheduleEnd(schedule: FlashSchedule, now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: schedule.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
  const localEnd = new Date(`${date}T${schedule.end_time}:00`)
  const offset = new Date(now.toLocaleString("en-US", { timeZone: schedule.timezone })).getTime() - now.getTime()
  return new Date(localEnd.getTime() - offset)
}

export function campaignIsAvailable(campaign: any, now = new Date()) {
  if (!campaign) return false
  const startsAt = campaign.starts_at ? new Date(campaign.starts_at) : null
  const endsAt = campaign.ends_at ? new Date(campaign.ends_at) : null
  return (!startsAt || startsAt <= now) && (!endsAt || now < endsAt)
}
