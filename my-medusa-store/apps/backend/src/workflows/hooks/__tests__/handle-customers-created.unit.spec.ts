import { handleCustomersCreated } from "../handlers/handle-customers-created";
import { StepResponse } from "@medusajs/framework/workflows-sdk";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import type { CustomerDTO } from "@medusajs/framework/types";

describe("handleCustomersCreated Unit Tests", () => {
  let mockCustomerModuleService: {
    updateCustomers: jest.Mock;
  };
  let mockContainer: {
    resolve: jest.Mock;
  };
  let mockContext: any;

  const mockCustomer: CustomerDTO = {
    id: "cus_123",
    email: "test@example.com",
    first_name: "Test",
    last_name: "User",
  } as CustomerDTO;

  beforeEach(() => {
    mockCustomerModuleService = {
      updateCustomers: jest.fn().mockResolvedValue({}),
    };

    mockContainer = {
      resolve: jest.fn((moduleName: string) => {
        if (moduleName === Modules.CUSTOMER) {
          return mockCustomerModuleService;
        }
        return null;
      }),
    };

    mockContext = {
      container: mockContainer,
    };
  });

  it("should successfully update metadata when both zalo_id and avatar_url are provided", async () => {
    const result = await handleCustomersCreated(
      {
        customers: [mockCustomer],
        additional_data: {
          zalo_id: "0987654321",
          avatar_url: "https://example.com/avatar.png",
        },
      },
      mockContext,
    );

    expect(result).toBeInstanceOf(StepResponse);
    expect(mockContainer.resolve).toHaveBeenCalledWith(Modules.CUSTOMER);
    expect(mockCustomerModuleService.updateCustomers).toHaveBeenCalledTimes(1);
    expect(mockCustomerModuleService.updateCustomers).toHaveBeenCalledWith(
      "cus_123",
      {
        metadata: {
          zalo_id: "0987654321",
          avatar_url: "https://example.com/avatar.png",
        },
      },
    );
  });

  it("should create minimal metadata patch containing only defined fields", async () => {
    const result = await handleCustomersCreated(
      {
        customers: [mockCustomer],
        additional_data: {
          zalo_id: "0987654321",
        },
      },
      mockContext,
    );

    expect(result).toBeInstanceOf(StepResponse);
    expect(mockCustomerModuleService.updateCustomers).toHaveBeenCalledWith(
      "cus_123",
      {
        metadata: {
          zalo_id: "0987654321",
        },
      },
    );
  });

  it("should safely no-op when additional_data is undefined or empty", async () => {
    const result1 = await handleCustomersCreated(
      {
        customers: [mockCustomer],
        additional_data: undefined,
      },
      mockContext,
    );
    expect(result1).toBeInstanceOf(StepResponse);

    const result2 = await handleCustomersCreated(
      {
        customers: [mockCustomer],
        additional_data: {},
      },
      mockContext,
    );
    expect(result2).toBeInstanceOf(StepResponse);

    expect(mockCustomerModuleService.updateCustomers).not.toHaveBeenCalled();
  });

  it("should safely no-op in batch operations when additional_data contains no Task 3 fields", async () => {
    const anotherCustomer = { ...mockCustomer, id: "cus_456" };
    const result = await handleCustomersCreated(
      {
        customers: [mockCustomer, anotherCustomer],
        additional_data: {
          unrelated_field: "some_value",
        },
      },
      mockContext,
    );

    expect(result).toBeInstanceOf(StepResponse);
    expect(mockCustomerModuleService.updateCustomers).not.toHaveBeenCalled();
  });

  it("should throw MedusaError INVALID_DATA when Task 3 fields fail schema validation", async () => {
    await expect(
      handleCustomersCreated(
        {
          customers: [mockCustomer],
          additional_data: {
            zalo_id: "invalid_id",
          },
        },
        mockContext,
      ),
    ).rejects.toThrow(
      new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Invalid Task 3 customer additional data.",
      ),
    );

    expect(mockCustomerModuleService.updateCustomers).not.toHaveBeenCalled();
  });

  it("should throw MedusaError INVALID_DATA when customers array is empty but Task 3 data is provided", async () => {
    await expect(
      handleCustomersCreated(
        {
          customers: [],
          additional_data: {
            zalo_id: "0987654321",
          },
        },
        mockContext,
      ),
    ).rejects.toThrow(
      new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cannot assign single-customer additional_data to 0 customers in batch.",
      ),
    );

    expect(mockCustomerModuleService.updateCustomers).not.toHaveBeenCalled();
  });

  it("should throw MedusaError INVALID_DATA when multiple customers are created with single Task 3 data", async () => {
    const anotherCustomer = { ...mockCustomer, id: "cus_456" };
    await expect(
      handleCustomersCreated(
        {
          customers: [mockCustomer, anotherCustomer],
          additional_data: {
            zalo_id: "0987654321",
          },
        },
        mockContext,
      ),
    ).rejects.toThrow(
      new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cannot assign single-customer additional_data to 2 customers in batch.",
      ),
    );

    expect(mockCustomerModuleService.updateCustomers).not.toHaveBeenCalled();
  });

  it("should propagate error when customerModuleService.updateCustomers fails", async () => {
    const dbError = new Error("Database connection failed");
    mockCustomerModuleService.updateCustomers.mockRejectedValue(dbError);

    await expect(
      handleCustomersCreated(
        {
          customers: [mockCustomer],
          additional_data: {
            zalo_id: "0987654321",
          },
        },
        mockContext,
      ),
    ).rejects.toThrow(dbError);
  });
});
