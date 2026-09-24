import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { Modules } from "@medusajs/framework/utils";
import type { INotificationModuleService, ICustomerModuleService, } from "@medusajs/framework/types";

// noinspection JSUnusedGlobalSymbols
export default async function customerCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {

  // 1. Resolve domain services | Nạp các service nghiệp vụ từ DI container
  const customerModuleService: ICustomerModuleService = container.resolve(Modules.CUSTOMER,);

  const notificationModuleService: INotificationModuleService = container.resolve(Modules.NOTIFICATION);

  // 2. Query customer data | Truy vấn thông tin khách hàng từ cơ sở dữ liệu
  const customerId = data.id;

  let customer: Awaited<ReturnType<ICustomerModuleService["retrieveCustomer"]>>;

  try {

    customer = await customerModuleService.retrieveCustomer(customerId);

  } catch (error: any) {

    const isNotFound = error?.type === "not_found" || error?.message?.includes("was not found");

    // Nếu khách hàng không tồn tại -> Bỏ qua an toàn, không thử lại
    // If customer is not found -> Skip gracefully, do not retry
    if (isNotFound) {

      console.log(`[customer-created] Customer ${customerId} not found. Skipping...`,);
      return;
    }

    // Lỗi DB/Hạ tầng mạng khác -> Ném lỗi ra để Redis Event Bus tự động kích hoạt retry
    // Rethrow unhandled DB/Network errors to trigger Redis event bus retry
    throw error;
  }

  // 3. Guard clause: Bỏ qua nếu khách hàng không có địa chỉ email hợp lệ
  // Guard clause: Skip if customer does not have a valid recipient email
  if (!customer.email) {

    console.log(`[customer-created] Customer ${customerId} has no email. Skipping...`,);
    return;
  }

  // 4. Dispatch welcome email | Gửi thông báo chào mừng kèm khóa Idempotency chống trùng lặp
  // Dispatch welcome email with unique idempotency key
  await notificationModuleService.createNotifications({
    to: customer.email,
    channel: "email",
    template: "customer-welcome",
    data: { customer },
    // Idempotency key: Đảm bảo chỉ gửi duy nhất 1 email chào mừng, kể cả khi server retry
    idempotency_key: `welcome-customer:${customer.id}:email`,
  } as any);
}

// Cấu hình Subscriber: Lắng nghe sự kiện "customer.created" phát ra từ Core Workflow
// Subscriber config: Listen to "customer.created" event emitted from core workflow
export const config: SubscriberConfig = {
  event: "customer.created",
};
