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
    // Reset mock functions trước mỗi test case
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

  // Các test case sẽ nằm ở đây...

  it("nên gửi email chào mừng với idempotency key khi customer có email", async () => {
    // 1. Arrange
    const mockCustomer = {
      id: "cus_01",
      email: "john@example.com",
      first_name: "John",
    };
    mockCustomerModuleService.retrieveCustomer.mockResolvedValue(mockCustomer);

    // 2. Act
    await customerCreatedHandler({
      event: { data: { id: "cus_01" } },
      container: mockContainer as any,
    } as any);

    // 3. Assert
    expect(mockCustomerModuleService.retrieveCustomer).toHaveBeenCalledWith(
      "cus_01",
    );
    expect(
      mockNotificationModuleService.createNotifications,
    ).toHaveBeenCalledWith({
      to: "john@example.com",
      channel: "email",
      template: "customer-welcome",
      data: { customer: mockCustomer },
      idempotency_key: "welcome-customer:cus_01:email",
    });
  });

  it("nên bỏ qua và không gửi email nếu customer không có email", async () => {
    // 1. Arrange
    const mockCustomerWithoutEmail = {
      id: "cus_02",
      email: null,
      first_name: "PhoneUser",
    };
    mockCustomerModuleService.retrieveCustomer.mockResolvedValue(
      mockCustomerWithoutEmail,
    );

    // 2. Act
    await customerCreatedHandler({
      event: { data: { id: "cus_02" } },
      container: mockContainer as any,
    } as any);

    // 3. Assert
    expect(mockCustomerModuleService.retrieveCustomer).toHaveBeenCalledWith(
      "cus_02",
    );
    expect(
      mockNotificationModuleService.createNotifications,
    ).not.toHaveBeenCalled();
  });

  it("nên bỏ qua an toàn và không throw nếu customer không tồn tại (not_found)", async () => {
    // 1. Arrange
    const notFoundError = {
      type: "not_found",
      message: "Customer was not found",
    };
    mockCustomerModuleService.retrieveCustomer.mockRejectedValue(notFoundError);

    // 2. Act & Assert: Hàm chạy xong êm đẹp, không throw error
    await expect(
      customerCreatedHandler({
        event: { data: { id: "cus_not_exist" } },
        container: mockContainer as any,
      } as any),
    ).resolves.not.toThrow();

    expect(
      mockNotificationModuleService.createNotifications,
    ).not.toHaveBeenCalled();
  });

  it("nên ném lỗi (rethrow) nếu gặp lỗi database hoặc sự cố mạng để Redis retry", async () => {
    // 1. Arrange
    const dbError = new Error("Database timeout");
    mockCustomerModuleService.retrieveCustomer.mockRejectedValue(dbError);

    // 2. Act & Assert: Bắt buộc phải throw lỗi ra ngoài
    await expect(
      customerCreatedHandler({
        event: { data: { id: "cus_03" } },
        container: mockContainer as any,
      } as any),
    ).rejects.toThrow("Database timeout");
  });
});
