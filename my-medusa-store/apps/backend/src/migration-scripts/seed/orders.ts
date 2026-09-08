import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { DEMO_CUSTOMERS } from "./customers";

/**
 * Seed a few low-volume DEMO orders — run with:
 *   npx medusa exec ./src/scripts/orders.ts
 *
 * Requires `customers.ts` first (orders reference those demo customer ids).
 * Product handles referenced below must exist in the catalog seed
 * (src/migration-scripts/seed/products.ts).
 *
 * Idempotent: deletes existing orders for the demo customers before re-inserting.
 */

// Any positive integer VND — cosmetic only (money = integer VND).
const UNIT_PRICE = 100_000;

// email -> [ [product handle, quantity], ... ]
const PURCHASES: Record<string, [string, number][]> = {
  "conghung@gmail.com": [
    ["yonex-bg65", 3],
    ["yonex-pro-bag-92026", 2],
    ["yonex-ac102-towel-grip", 1],
  ],
  "ngocthuc@gmail.com": [
    ["yonex-bg65", 2],
    ["yonex-pro-bag-92026", 2],
    ["victor-vbs-63", 1],
  ],
  "congson@gmail.com": [
    ["yonex-bg65", 1],
    ["yonex-ac102-towel-grip", 2],
    ["victor-br9111-bag", 1],
    ["yonex-socks-19120", 2],
  ],
};

// Các import giả định (bạn giữ nguyên như file cũ của bạn)
// import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils";
// import { DEMO_CUSTOMERS, PURCHASES, UNIT_PRICE } from "./your-constants-file";

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Lấy danh sách Customer và map thành Map<email, id>
 */
async function getCustomerMap(
  customerModule: any,
  emails: string[],
): Promise<Map<string, string>> {
  const customers = await customerModule.listCustomers({ email: emails });
  return new Map(customers.map((c: any) => [c.email, c.id]));
}

/**
 * Lấy danh sách Product và map thành Map<handle, { id, variantId }>
 */
async function getProductMap(
  query: any,
): Promise<Map<string, { id: string; variantId: string | null }>> {
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id"],
    pagination: { take: 1000, skip: 0 },
  });

  return new Map(
    (products as any[]).map((p) => [
      p.handle,
      { id: p.id, variantId: p.variants?.[0]?.id ?? null },
    ]),
  );
}

/**
 * Check và xóa các order cũ (Idempotent)
 */
async function cleanUpExistingOrders(
  orderModule: any,
  customerIds: string[],
  logger: any,
) {
  const existing = await orderModule.listOrders(
    { customer_id: customerIds },
    { select: ["id"] },
  );

  if (existing.length) {
    await orderModule.deleteOrders(existing.map((o: any) => o.id));
    logger.info(
      `[seed:orders] removed ${existing.length} prior demo orders (idempotent).`,
    );
  }
}

function buildOrderItems(
  lines: [string, number][],
  byHandle: Map<string, { id: string; variantId: string | null }>,
  logger: any,
): any[] {
  return lines.reduce((acc: any[], [handle, quantity]) => {
    const prod = byHandle.get(handle);

    if (!prod) {
      logger.warn(`[seed:orders] product "${handle}" not found — skip item.`);
      return acc;
    }

    acc.push({
      title: handle,
      quantity,
      unit_price: UNIT_PRICE, // *Lưu ý: Bạn cần import hoặc truyền UNIT_PRICE vào nếu nó ở file khác
      product_id: prod.id,
      ...(prod.variantId ? { variant_id: prod.variantId } : {}),
    });

    return acc;
  }, []);
}

function buildSingleOrder(
  email: string,
  customerId: string,
  items: any[],
  context: { regionId?: string; salesChannelId?: string },
) {
  return {
    email,
    customer_id: customerId,
    currency_code: "vnd",
    status: "completed",
    items,
    ...(context.regionId ? { region_id: context.regionId } : {}),
    ...(context.salesChannelId
      ? { sales_channel_id: context.salesChannelId }
      : {}),
  };
}

function buildOrdersPayload(
  purchases: Record<string, [string, number][]>,
  custIdByEmail: Map<string, string>,
  byHandle: Map<string, { id: string; variantId: string | null }>,
  context: { regionId?: string; salesChannelId?: string },
  logger: any,
): any[] {
  return Object.entries(purchases).reduce((orders: any[], [email, lines]) => {
    const customerId = custIdByEmail.get(email);

    if (!customerId) {
      logger.warn(`[seed:orders] customer ${email} missing — skip its order.`);
      return orders;
    }

    const items = buildOrderItems(lines, byHandle, logger);

    if (items.length > 0) {
      orders.push(buildSingleOrder(email, customerId, items, context));
    }

    return orders;
  }, []);
}

// -----------------------------------------------------------------------------
// MAIN ORCHESTRATOR FUNCTION
// -----------------------------------------------------------------------------

export async function seedOrders({ container }: ExecArgs) {
  const logger = container.resolve("logger");
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const orderModule = container.resolve(Modules.ORDER);
  const customerModule = container.resolve(Modules.CUSTOMER);
  const regionModule = container.resolve(Modules.REGION);
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL);

  // 1. Fetch & Map Customers
  const emails = DEMO_CUSTOMERS.map((c) => c.email);
  const custIdByEmail = await getCustomerMap(customerModule, emails);

  if (!custIdByEmail.size) {
    logger.warn(
      "[seed:orders] no demo customers found — run customers.ts first. Aborting.",
    );
    return;
  }

  // 2. Fetch & Map Products
  const byHandle = await getProductMap(query);

  // 3. Fetch Context (Region & Sales Channel)
  const [region] = await regionModule.listRegions({ name: "Vietnam" });
  const [salesChannel] = await salesChannelModule.listSalesChannels({
    name: "Default Sales Channel",
  });

  // 4. Idempotent cleanup
  await cleanUpExistingOrders(orderModule, [...custIdByEmail.values()], logger);

  // 5. Build Payload
  const orders = buildOrdersPayload(
    PURCHASES,
    custIdByEmail,
    byHandle,
    { regionId: region?.id, salesChannelId: salesChannel?.id },
    logger,
  );

  // 6. Execute Insert
  if (orders.length) {
    await orderModule.createOrders(orders);
  }

  // 7. Log Result
  const totalUnits = Object.values(PURCHASES)
    .flat()
    .reduce((sum, [, qty]) => sum + qty, 0);

  logger.info(
    `[seed:orders] created ${orders.length} demo orders (${totalUnits} total units).`,
  );
}
