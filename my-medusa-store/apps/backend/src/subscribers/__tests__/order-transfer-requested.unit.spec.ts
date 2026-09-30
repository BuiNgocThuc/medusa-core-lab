import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import orderTransferRequestedHandler, { type OrderTransferRequestedEventData, } from "../order-transfer-requested";

describe("orderTransferRequestedHandler Unit Tests", () => {
    let mockLogger: {
        info: jest.Mock;
        warn: jest.Mock;
        error: jest.Mock;
    };

    let mockQuery: {
        graph: jest.Mock;
    };

    let mockContainer: {
        resolve: jest.Mock;
    };

    const defaultEventData: OrderTransferRequestedEventData = {
        id: "order_01TESTORDER",
        order_change_id: "ordch_01TESTCHANGE",
    };

    beforeEach(() => {
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        mockQuery = {
            graph: jest.fn(),
        };

        mockContainer = {
            resolve: jest.fn((key: string) => {
                if (key === ContainerRegistrationKeys.LOGGER) {
                    return mockLogger;
                }
                if (key === ContainerRegistrationKeys.QUERY) {
                    return mockQuery;
                }
                return undefined;
            }),
        };

        jest.clearAllMocks();
    });

    it("should extract token and log confirmation URL on valid transfer_customer action", async () => {
        const fakeToken = "550e8400-e29b-41d4-a716-446655440000";
        const fakeOriginalEmail = "guest_customer@example.com";

        mockQuery.graph.mockResolvedValueOnce({
            data: [
                {
                    id: defaultEventData.order_change_id,
                    status: "requested",
                    change_type: "transfer",
                    actions: [
                        {
                            action: "transfer_customer",
                            details: {
                                token: fakeToken,
                                original_email: fakeOriginalEmail,
                            },
                        },
                    ],
                },
            ],
        });

        await orderTransferRequestedHandler({
            event: { data: defaultEventData } as any,
            container: mockContainer as any,
            pluginOptions: {},
        });

        expect(mockQuery.graph).toHaveBeenCalledWith({
            entity: "order_change",
            fields: ["id", "status", "change_type", "actions.*"],
            filters: { id: defaultEventData.order_change_id },
        });

        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining("Order transfer confirmation URL generated"),
        );
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(fakeToken));
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it("should warn and return early when order change record is not found", async () => {
        mockQuery.graph.mockResolvedValueOnce({
            data: [],
        });

        await orderTransferRequestedHandler({
            event: { data: defaultEventData } as any,
            container: mockContainer as any,
            pluginOptions: {},
        });

        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining("not found for order"),
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it("should warn and return early when order change has no transfer_customer action", async () => {
        mockQuery.graph.mockResolvedValueOnce({
            data: [
                {
                    id: defaultEventData.order_change_id,
                    actions: [
                        {
                            action: "item_add",
                            details: {},
                        },
                    ],
                },
            ],
        });

        await orderTransferRequestedHandler({
            event: { data: defaultEventData } as any,
            container: mockContainer as any,
            pluginOptions: {},
        });

        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining("No transfer_customer action found"),
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it("should log error and return early when transfer_customer action lacks token", async () => {
        mockQuery.graph.mockResolvedValueOnce({
            data: [
                {
                    id: defaultEventData.order_change_id,
                    actions: [
                        {
                            action: "transfer_customer",
                            details: {},
                        },
                    ],
                },
            ],
        });

        await orderTransferRequestedHandler({
            event: { data: defaultEventData } as any,
            container: mockContainer as any,
            pluginOptions: {},
        });

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining("Token missing in transfer_customer action details"),
        );
    });
});
