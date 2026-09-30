import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { ICustomerModuleService } from "@medusajs/framework/types";

jest.setTimeout(90000);

medusaIntegrationTestRunner({
    testSuite: ({ getContainer }) => {
        describe("Customer Identity & DB Contract Verification", () => {
            let customerService: ICustomerModuleService;

            beforeEach(() => {
                const container = getContainer();
                customerService = container.resolve(Modules.CUSTOMER);
            });

            it("should allow a guest customer and a registered customer to share the same email", async () => {
                const email = "reconcile_test@example.com";

                const created = await customerService.createCustomers([
                    {
                        email,
                        first_name: "Guest",
                        last_name: "User",
                        has_account: false,
                    },
                    {
                        email,
                        first_name: "Registered",
                        last_name: "Member",
                        has_account: true,
                    },
                ]);

                expect(created).toHaveLength(2);

                const [guest, registered] = created;
                expect(guest.id).toBeDefined();
                expect(registered.id).toBeDefined();
                expect(guest.id).not.toEqual(registered.id);
                expect(guest.email).toEqual(email);
                expect(registered.email).toEqual(email);
                expect(guest.has_account).toBe(false);
                expect(registered.has_account).toBe(true);
            });

            it("should reject creating duplicate guest customers with the same email", async () => {
                const email = "guest_duplicate@example.com";

                await customerService.createCustomers({
                    email,
                    first_name: "First",
                    last_name: "Guest",
                    has_account: false,
                });

                await expect(
                    customerService.createCustomers({
                        email,
                        first_name: "Second",
                        last_name: "Guest",
                        has_account: false,
                    }),
                ).rejects.toThrow();
            });

            it("should reject creating duplicate registered customers with the same email", async () => {
                const email = "member_duplicate@example.com";

                await customerService.createCustomers({
                    email,
                    first_name: "First",
                    last_name: "Member",
                    has_account: true,
                });

                await expect(
                    customerService.createCustomers({
                        email,
                        first_name: "Second",
                        last_name: "Member",
                        has_account: true,
                    }),
                ).rejects.toThrow();
            });

            it("should allow recreating a customer after soft deletion", async () => {
                const email = "lifecycle_test@example.com";

                const initialCustomer = await customerService.createCustomers({
                    email,
                    first_name: "Original",
                    last_name: "Member",
                    has_account: true,
                });

                await customerService.deleteCustomers(initialCustomer.id);

                const recreatedCustomer = await customerService.createCustomers({
                    email,
                    first_name: "Recreated",
                    last_name: "Member",
                    has_account: true,
                });

                expect(recreatedCustomer).toBeDefined();
                expect(recreatedCustomer.id).not.toEqual(initialCustomer.id);
                expect(recreatedCustomer.email).toEqual(email);
                expect(recreatedCustomer.has_account).toBe(true);
            });

            it("should reject in-place upgrade via updateCustomers when registered account already exists (duplicate key collision)", async () => {
                const email = "in_place_upgrade_collision@example.com";

                // 1. Arrange: Ca ca khach Guest va Registered cung ton tai tren 1 email
                const [guest, registered] = await customerService.createCustomers([
                    {
                        email,
                        first_name: "Guest",
                        last_name: "User",
                        has_account: false,
                    },
                    {
                        email,
                        first_name: "Registered",
                        last_name: "Member",
                        has_account: true,
                    },
                ]);

                expect(guest.id).toBeDefined();
                expect(registered.id).toBeDefined();
                expect(guest.has_account).toBe(false);
                expect(registered.has_account).toBe(true);

                // 2. Act & Assert: Co tinh In-place Upgrade ban ghi Guest bang cach cap nhat has_account = true.
                // PostgreSQL bat buoc phai nem loi vi pham partial unique index constraint.
                await expect(
                    customerService.updateCustomers(guest.id, {
                        has_account: true,
                    } as any),
                ).rejects.toThrow();
            });
        });
    },
});
