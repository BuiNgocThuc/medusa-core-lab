// init-data-seed
import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
    seedStoreAndRegion,
    seedStockAndShipping,
    seedCategories,
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
export default async function initial_data_seed({ container }: { container: MedusaContainer }) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const salesChannelModule = container.resolve(Modules.SALES_CHANNEL);

    const already = await salesChannelModule.listSalesChannels({
        name: "Default Sales Channel",
    });
    if (already.length) {
        logger.warn("[seed] Default Sales Channel already exists — DB looks seeded. Skipping.");
        return;
    }

    logger.info("[seed] store + sales channel + region...");
    const { defaultSalesChannel, region } = await seedStoreAndRegion(container);

    logger.info("[seed] stock location + shipping...");
    const { stockLocation, shippingProfile } = await seedStockAndShipping(container, {
        regionId: region.id,
        salesChannelId: defaultSalesChannel.id,
    });

    logger.info("[seed] categories...");
    const categoryResult = await seedCategories(container);

    logger.info("[seed] products...");
    await seedProducts(container, {
        categoryResult,
        shippingProfileId: shippingProfile.id,
        salesChannelId: defaultSalesChannel.id,
    });

    logger.info("[seed] inventory levels...");
    await seedInventory(container, stockLocation.id);

    logger.info("[seed] demo customers...");
    const execArgs = { container, args: [] as string[] };
    await seedCustomers(execArgs);

    logger.info("[seed] demo orders...");
    await seedOrders(execArgs);

    logger.info("[seed] Catalog done.");
}
