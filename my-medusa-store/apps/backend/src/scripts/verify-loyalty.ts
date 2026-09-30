import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { LOYALTY_MODULE } from "@/src/modules/loyalty";

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

  const loyaltyService = container.resolve(LOYALTY_MODULE);
  const points = await loyaltyService.getPoints(customerId);
  const loyaltyPointsRecords = await loyaltyService.listLoyaltyPoints({ customer_id: customerId });

  logger.info(`Customer: ${customer.id} (${customer.email})`);
  logger.info(`Loyalty Points Balance: ${points}`);
  logger.info(`Loyalty Points Record: ${JSON.stringify(loyaltyPointsRecords, null, 2)}`);
  if ((customer as any).loyalty_account) {
    logger.info(`Loyalty Account Link Data: ${JSON.stringify((customer as any).loyalty_account, null, 2)}`);
  }
}
