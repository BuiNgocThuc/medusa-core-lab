import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { LoyaltyTier } from "../models/loyalty-account";
import { LOYALTY_MODULE } from "..";

jest.setTimeout(90000);

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("Loyalty Module and Module Link Integration Tests", () => {
      let container: any;
      let loyaltyService: any;
      let customerService: any;
      let link: any;
      let query: any;

      beforeEach(() => {
        container = getContainer();
        loyaltyService = container.resolve(LOYALTY_MODULE);
        customerService = container.resolve(Modules.CUSTOMER);
        link = container.resolve(ContainerRegistrationKeys.LINK);
        query = container.resolve(ContainerRegistrationKeys.QUERY);
      });

      // Test Case 1: Default Values
      it("should create LoyaltyAccount with default values (points = 0, tier = BRONZE)", async () => {
        const created = await loyaltyService.createLoyaltyAccounts({
          customer_id: "cus_default_test_1",
        });
        const loyaltyAccount = Array.isArray(created) ? created[0] : created;

        expect(loyaltyAccount).toBeDefined();
        expect(loyaltyAccount.id).toBeDefined();
        expect(loyaltyAccount.customer_id).toBe("cus_default_test_1");
        expect(loyaltyAccount.points).toBe(0);
        expect(loyaltyAccount.tier).toBe(LoyaltyTier.BRONZE);
      });

      // Test Case 2: Unique customer_id Constraint
      it("should reject creating two LoyaltyAccounts with the same customer_id", async () => {
        const customerId = "cus_duplicate_test";

        await loyaltyService.createLoyaltyAccounts({
          customer_id: customerId,
        });

        let error: any;
        try {
          await loyaltyService.createLoyaltyAccounts({
            customer_id: customerId,
          });
        } catch (err) {
          error = err;
        }

        expect(error).toBeDefined();
      });

      // Test Case 3: Happy Path Query Graph
      it("should resolve customer.loyalty_account via Query Graph after linking", async () => {
        const createdCustomer = await customerService.createCustomers({
          email: "happy_path@example.com",
          first_name: "John",
          last_name: "Doe",
        });
        const customer = Array.isArray(createdCustomer)
          ? createdCustomer[0]
          : createdCustomer;

        const createdLoyalty = await loyaltyService.createLoyaltyAccounts({
          customer_id: customer.id,
          points: 150,
          tier: LoyaltyTier.SILVER,
        });
        const loyaltyAccount = Array.isArray(createdLoyalty)
          ? createdLoyalty[0]
          : createdLoyalty;

        await link.create([
          {
            [Modules.CUSTOMER]: {
              customer_id: customer.id,
            },
            [LOYALTY_MODULE]: {
              loyalty_account_id: loyaltyAccount.id,
            },
          },
        ]);

        const { data } = await query.graph({
          entity: "customer",
          fields: ["id", "email", "loyalty_account.*"],
          filters: { id: customer.id },
        });

        expect(data).toHaveLength(1);
        expect(data[0].id).toBe(customer.id);
        expect(data[0].loyalty_account).toBeDefined();
        expect(data[0].loyalty_account.id).toBe(loyaltyAccount.id);
        expect(data[0].loyalty_account.points).toBe(150);
        expect(data[0].loyalty_account.tier).toBe(LoyaltyTier.SILVER);
      });

      // Test Case 4: Link Isolation Test
      it("should return loyalty_account as null or undefined when customer is not linked", async () => {
        const createdCustomer = await customerService.createCustomers({
          email: "isolation_test@example.com",
        });
        const customer = Array.isArray(createdCustomer)
          ? createdCustomer[0]
          : createdCustomer;

        // Create loyalty account with customer.id in its own table, but DO NOT create link record
        await loyaltyService.createLoyaltyAccounts({
          customer_id: customer.id,
          points: 50,
        });

        const { data } = await query.graph({
          entity: "customer",
          fields: ["id", "email", "loyalty_account.*"],
          filters: { id: customer.id },
        });

        expect(data).toHaveLength(1);
        expect(data[0].loyalty_account).toBeFalsy();
      });

      // Test Case 5: 1-to-1 Constraint Rejection
      it("should reject linking a second LoyaltyAccount to the same Customer (1-to-1 constraint)", async () => {
        const createdCustomer = await customerService.createCustomers({
          email: "one_to_one@example.com",
        });
        const customer = Array.isArray(createdCustomer)
          ? createdCustomer[0]
          : createdCustomer;

        const createdAccount1 = await loyaltyService.createLoyaltyAccounts({
          customer_id: "cus_mock_1",
        });
        const loyaltyAccount1 = Array.isArray(createdAccount1)
          ? createdAccount1[0]
          : createdAccount1;

        const createdAccount2 = await loyaltyService.createLoyaltyAccounts({
          customer_id: "cus_mock_2",
        });
        const loyaltyAccount2 = Array.isArray(createdAccount2)
          ? createdAccount2[0]
          : createdAccount2;

        // First link succeeds
        await link.create([
          {
            [Modules.CUSTOMER]: {
              customer_id: customer.id,
            },
            [LOYALTY_MODULE]: {
              loyalty_account_id: loyaltyAccount1.id,
            },
          },
        ]);

        // Second link to the same customer must throw error because defineLink(Customer, LoyaltyAccount) is 1-to-1
        let error: any;
        try {
          await link.create([
            {
              [Modules.CUSTOMER]: {
                customer_id: customer.id,
              },
              [LOYALTY_MODULE]: {
                loyalty_account_id: loyaltyAccount2.id,
              },
            },
          ]);
        } catch (err) {
          error = err;
        }

        expect(error).toBeDefined();

        // Verify the original link is still intact
        const { data } = await query.graph({
          entity: "customer",
          fields: ["id", "loyalty_account.id"],
          filters: { id: customer.id },
        });
        expect(data[0].loyalty_account.id).toBe(loyaltyAccount1.id);
      });

      // Test Case 6: Hybrid Drift Illustration
      it("should illustrate hybrid data drift when stored link differs from customer_id attribute", async () => {
        const createdCustomerA = await customerService.createCustomers({
          email: "customera@example.com",
        });
        const customerA = Array.isArray(createdCustomerA)
          ? createdCustomerA[0]
          : createdCustomerA;

        const createdCustomerB = await customerService.createCustomers({
          email: "customerb@example.com",
        });
        const customerB = Array.isArray(createdCustomerB)
          ? createdCustomerB[0]
          : createdCustomerB;

        // LoyaltyAccount created with customer_id of Customer B
        const createdAccountB = await loyaltyService.createLoyaltyAccounts({
          customer_id: customerB.id,
          points: 300,
        });
        const loyaltyAccountB = Array.isArray(createdAccountB)
          ? createdAccountB[0]
          : createdAccountB;

        // Stored link deliberately links Customer A to loyaltyAccountB
        await link.create([
          {
            [Modules.CUSTOMER]: {
              customer_id: customerA.id,
            },
            [LOYALTY_MODULE]: {
              loyalty_account_id: loyaltyAccountB.id,
            },
          },
        ]);

        // Query graph for Customer A resolves loyaltyAccountB
        const { data } = await query.graph({
          entity: "customer",
          fields: ["id", "loyalty_account.*"],
          filters: { id: customerA.id },
        });

        expect(data[0].loyalty_account).toBeDefined();
        expect(data[0].loyalty_account.id).toBe(loyaltyAccountB.id);
        // DRIFT: customer.id is customerA.id, but loyalty_account.customer_id is customerB.id
        expect(data[0].loyalty_account.customer_id).toBe(customerB.id);
        expect(data[0].loyalty_account.customer_id).not.toBe(customerA.id);
      });
    });
  },
});
