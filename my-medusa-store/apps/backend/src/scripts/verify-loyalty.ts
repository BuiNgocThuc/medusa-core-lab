import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";

export default async function verifyLoyalty({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const customerId = args?.[0];
  if (!customerId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Vui long cung cap Customer ID: pnpm exec medusa exec ./src/scripts/verify-loyalty.ts <customer_id>"
    );
  }

  const { data } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "loyalty_account.*"],
    filters: { id: customerId },
  });

  const customer = data?.[0];
  if (!customer) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Khong tim thay Customer voi ID: ${customerId}`
    );
  }

  const loyaltyAccount = (customer as any).loyalty_account;
  if (!loyaltyAccount) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Customer ${customerId} khong co LoyaltyAccount duoc lien ket.`
    );
  }

  if (loyaltyAccount.customer_id !== customer.id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Phat hien lech du lieu: LoyaltyAccount.customer_id (${loyaltyAccount.customer_id}) khong khop voi Customer.id (${customer.id})`
    );
  }

  logger.info(`Customer: ${customer.id} (${customer.email})`);
  logger.info(`Loyalty Data: ${JSON.stringify(loyaltyAccount, null, 2)}`);
}
