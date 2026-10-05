import customerCreatedHandler from "../customer-created";
import { Modules } from "@medusajs/framework/utils";

describe("customerCreatedHandler", () => {

  let mockCustomerModuleService: {
    retrieveCustomer: jest.Mock;
  };

  let mockNotificationModuleService: {
    createNotifications: jest.Mock;
  };

  let mockContainer: {
    resolve: jest.Mock;
  };

  beforeEach(() => {

    // Reset mock functions trước mỗi test case | Reset mock functions before each test case
    mockCustomerModuleService = {
      retrieveCustomer: jest.fn(),
    };

    mockNotificationModuleService = {
      createNotifications: jest.fn(),
    };

    mockContainer = {
      resolve: jest.fn((moduleName: string) => {

        if (moduleName === Modules.CUSTOMER) {

          return mockCustomerModuleService;

        }

        if (moduleName === Modules.NOTIFICATION) {

          return mockNotificationModuleService;

        }

        return null;

      }),
    };

  });

  // Suite: Customer Created Event Subscriber Unit Tests | Bộ kiểm thử đơn vị cho subscriber customer-created

  it("nên gửi email chào mừng với idempotency key khi customer có email", async () => {

    // 1. Arrange | Chuẩn bị dữ liệu mẫu và mock dependencies
    const mockCustomer = {
      id: "cus_01",
      email: "john@example.com",
      first_name: "John",
    };

    mockCustomerModuleService.retrieveCustomer.mockResolvedValue(mockCustomer);

    // 2. Act | Kích hoạt handler xử lý sự kiện
    await customerCreatedHandler({
      event: { data: { id: "cus_01" } },
      container: mockContainer as any,
    } as any);

    // 3. Assert | Kiểm tra lời gọi service và tham số đầu vào
    expect(mockCustomerModuleService.retrieveCustomer).toHaveBeenCalledWith("cus_01");

    expect(mockNotificationModuleService.createNotifications).toHaveBeenCalledWith({
      to: "john@example.com",
      channel: "email",
      template: "customer-welcome",
      data: { customer: mockCustomer },
      idempotency_key: "welcome-customer:cus_01:email",
    });

  });

  it("nên bỏ qua và không gửi email nếu customer không có email", async () => {

    // 1. Arrange | Chuẩn bị khách hàng không có địa chỉ email
    const mockCustomerWithoutEmail = {
      id: "cus_02",
      email: null,
      first_name: "PhoneUser",
    };

    mockCustomerModuleService.retrieveCustomer.mockResolvedValue(mockCustomerWithoutEmail);

    // 2. Act | Kích hoạt handler xử lý sự kiện
    await customerCreatedHandler({
      event: { data: { id: "cus_02" } },
      container: mockContainer as any,
    } as any);

    // 3. Assert | Xác nhận không gọi service gửi thông báo
    expect(mockCustomerModuleService.retrieveCustomer).toHaveBeenCalledWith("cus_02");

    expect(mockNotificationModuleService.createNotifications).not.toHaveBeenCalled();

  });

  it("nên bỏ qua an toàn và không throw nếu customer không tồn tại (not_found)", async () => {

    // 1. Arrange | Giả lập lỗi không tìm thấy khách hàng (not_found)
    const notFoundError = {
      type: "not_found",
      message: "Customer was not found",
    };

    mockCustomerModuleService.retrieveCustomer.mockRejectedValue(notFoundError);

    // 2. Act & Assert: Hàm chạy xong êm đẹp, không throw error
    // Safe handling: resolve gracefully without throwing error on not_found
    await expect(
      customerCreatedHandler({
        event: { data: { id: "cus_not_exist" } },
        container: mockContainer as any,
      } as any)
    ).resolves.not.toThrow();

    expect(mockNotificationModuleService.createNotifications).not.toHaveBeenCalled();

  });

  it("nên ném lỗi (rethrow) nếu gặp lỗi database hoặc sự cố mạng để Redis retry", async () => {

    // 1. Arrange | Giả lập lỗi kết nối cơ sở dữ liệu
    const dbError = new Error("Database timeout");

    mockCustomerModuleService.retrieveCustomer.mockRejectedValue(dbError);

    // 2. Act & Assert: Bắt buộc phải throw lỗi ra ngoài để cơ chế hàng đợi Redis retry
    // Rethrow database/network error to allow Redis message queue retry
    await expect(
      customerCreatedHandler({
        event: { data: { id: "cus_03" } },
        container: mockContainer as any,
      } as any)
    ).rejects.toThrow("Database timeout");

  });

});

