// init-data-seed
import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  seedStoreAndRegion,
  seedStockAndShipping,
  seedCategories,
  seedCollections,
  seedCustomerGroups,
  seedMarketing,
  seedProducts,
  seedInventory,
  seedCustomers,
  seedOrders,
} from "./seed";

/**
 * Badminton catalog seed (VND). Orchestrates each domain from
 * ./seed/*.ts (store/region, stock/shipping, categories, products,
 * inventory) plus the standalone demo customer/order fixtures under
 * ../scripts/*.ts.
 *
 * Run once on a fresh DB after migrations:
 *   npx medusa exec ./src/migration-scripts/initial-data-seed.ts
 *
 * Scope note: VoucherEngine and SuggestiveSelling modules are not built yet in
 * this project, so voucher/promotion fixtures and their downstream seeds are
 * intentionally left out. Free-shipping threshold rules are also deferred
 * pending SRS clarification — shipping uses flat pricing only for now.
 *
 * Idempotent guard: skips entirely if a Default Sales Channel already exists.
 * All money is VND (integer, no minor units).
 */
export default async function initial_data_seed({
                                                  container,
                                                }: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL);

  const [existingSalesChannel] = await salesChannelModule.listSalesChannels({ name: "Default Sales Channel" });
  logger.info("[seed] store + sales channel + region...");
  const { defaultSalesChannel, region } = existingSalesChannel
    ? { defaultSalesChannel: existingSalesChannel, region: undefined }
    : await seedStoreAndRegion(container);

  logger.info("[seed] stock location + shipping...");
  if (!region) {
    logger.warn("[seed] core store exists; run domain seed scripts individually to avoid duplicating fulfillment data.");
    return;
  }
  const { stockLocation, shippingProfile } = await seedStockAndShipping(container, { regionId: region.id, salesChannelId: defaultSalesChannel.id });

  logger.info("[seed] categories...");
  const categoryResult = await seedCategories(container);

  logger.info("[seed] customer groups...");
  await seedCustomerGroups(container);

  logger.info("[seed] campaigns and promotions...");
  await seedMarketing(container);

  logger.info("[seed] products...");
  await seedProducts(container, {
    categoryResult,
    shippingProfileId: shippingProfile.id,
    salesChannelId: defaultSalesChannel.id,
  });

  logger.info("[seed] collections...");
  await seedCollections(container);

  logger.info("[seed] inventory levels...");
  await seedInventory(container, stockLocation.id);

  logger.info("[seed] demo customers...");
  const execArgs = { container, args: [] as string[] };
  await seedCustomers(execArgs);

  logger.info("[seed] demo orders...");
  await seedOrders(execArgs);

  logger.info("[seed] Catalog done.");
}
