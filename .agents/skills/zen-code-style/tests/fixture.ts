/**
 * Zen Code Style — Synthetic Sandbox Fixture
 *
 * File này chứa đầy đủ 24 edge cases để kiểm tra
 * thuật toán AI Invariant Checklist của @zen-code-style skill.
 *
 * KHÔNG phải production code. Chỉ dùng cho dry-run testing.
 */

// Edge Case 24: "use strict" directive tại dòng đầu
"use strict"

import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
// Edge Case 5: Multi-line import — CẤM padding bên trong
import type {
  ICustomerModuleService,
  INotificationModuleService,
} from "@medusajs/framework/types"

// Edge Case 13: Interface / Type — Compact, không Block Padding
interface CustomerPayload {
  id: string
  email: string
  metadata?: Record<string, unknown>
}

// Edge Case 22: Enum ≤ 3 values — Compact
enum NotificationChannel {
  EMAIL = "email",
  SMS = "sms",
}

// Edge Case 4: Config Object ≤ 2 keys — Không Block Padding
export const config: SubscriberConfig = {
  event: "customer.created",
}

// Edge Case 16: noinspection IDE directive — Zero Detachment
// noinspection JSUnusedGlobalSymbols
export default async function zenStyleFixtureHandler(
  // Edge Case 14: Destructuring trong tham số hàm — KHÔNG padding bên trong
  {
    event: { data },
    container,
  }: SubscriberArgs<{ id: string }>
) {

  // Edge Case 1: Template literal chứa ${} — CẤM can thiệp
  const welcomeKey = `welcome-customer:${data.id}:email`

  // Edge Case 8: Semicolons — theo Profile (lab-personal: giữ ;)
  const customerModuleService: ICustomerModuleService = container.resolve(Modules.CUSTOMER);

  const notificationService: INotificationModuleService = container.resolve(Modules.NOTIFICATION);

  // Edge Case 1: Regex chứa {} — CẦM can thiệp
  const phoneRegex = /^[0-9]{8,20}$/

  const customerId = data.id;

  let customer: CustomerPayload | null = null;

  // Edge Case 2: try/catch Execution Block — CÓ Block Padding
  try {

    customer = await customerModuleService.retrieveCustomer(customerId) as CustomerPayload;

  } catch (error: unknown) {

    // Edge Case 3: Guard Clause trong catch — Padding nhẹ
    if ((error as { type?: string })?.type === "not_found") {

      console.log(`[fixture] Customer ${customerId} not found. Skipping...`)
      return;

    }

    // Edge Case 17: throw statement trước khi đóng block
    throw error;

  }

  // Edge Case 10: Guard clause sau try/catch
  if (!customer?.email) {

    console.log(`[fixture] No email. Skipping...`)
    return;

  }

  // Edge Case 5: Multi-line if condition — Condition Boundary, KHÔNG padding
  if (
    customer.metadata?.blacklisted === true ||
    customer.metadata?.unsubscribed === true
  ) {

    console.log(`[fixture] Customer opted out. Skipping...`)
    return;

  }

  // Edge Case 15: Arrow function ngắn ≤ 80 chars — Giữ 1 dòng
  const channels = [NotificationChannel.EMAIL, NotificationChannel.SMS]
  const activeChannels = channels.filter(c => c !== NotificationChannel.SMS)

  // Edge Case 7: Method chaining — Ngưỡng 100 chars
  const channelString = activeChannels
    .map(c => c.toUpperCase())
    .join(", ")

  // Edge Case 19: Inline Object trong args — Không padding bên trong
  await notificationService.createNotifications({
    to: customer.email,
    channel: "email",
    template: "customer-welcome",
    data: { customer },
    idempotency_key: welcomeKey, // Edge Case 7 trailing comment
  } as any)

  // Edge Case 10: Switch / Case — 1 dòng trống giữa các case độc lập
  switch (channelString) {

    case "EMAIL":
      console.log("[fixture] Sent via email")
      break

    case "SMS":
      console.log("[fixture] Sent via sms")
      break

    // Edge Case 17: Switch Case có khối scope {}
    case "EMAIL, SMS": {

      const msg = "multi-channel"
      console.log(`[fixture] ${msg}`)
      break

    }

    default:
      break

  }

  // Edge Case 11: Ternary đơn giản — giữ nguyên nếu gọn
  const logLevel = customer.metadata ? "info" : "debug"
  console.log(`[fixture] Done. Level: ${logLevel}`)

}

// Edge Case 23: Tagged Template — CẤM can thiệp (ví dụ SQL)
// const rawQuery = sql`SELECT id FROM customer WHERE id = ${customerId}`
// → Dòng trên nếu uncomment, CẦM dãn dòng trống bên trong backtick

// Edge Case 9: Từ Việt mới → Sync vietnamese.dic nếu cần
// Ví dụ: từ "đăng ký", "chào mừng", "kiểm tra", "truy vấn"
