import type { ExecArgs, Logger, RemoteQueryFunction } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils";
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows";
import { TIER_MODULE, TierModuleService } from "@/src/modules/tier";
import { seedLoyaltyBalance } from "./seed-loyalty";
import { Link } from "@medusajs/framework/modules-sdk";

// --- Types ---
interface SeedDependencies {
    logger: Logger;
    promotionModule: any;
    tierService: TierModuleService;
    remoteLink: Link;
    query: RemoteQueryFunction;
    orderModule: any;
    regionModule: any;
    salesChannelModule: any;
}

const PASSWORD = "supersecret";

const tiers = [
    { name: "Bronze", min_purchase_value: 0, promotion_code: null },
    { name: "Silver", min_purchase_value: 2_000_000, promotion_code: "TIER_SILVER" },
    { name: "Gold", min_purchase_value: 10_000_000, promotion_code: "TIER_GOLD" },
    { name: "VIP", min_purchase_value: 20_000_000, promotion_code: null },
];

const customers = [
    {
        email: "tier-bronze-1@example.test",
        first_name: "Bronze",
        last_name: "One",
        tier: "Bronze",
        spend: 100_000,
        loyalty_points: 0,
    },
    {
        email: "tier-bronze-2@example.test",
        first_name: "Bronze",
        last_name: "Two",
        tier: "Bronze",
        spend: 500_000,
        loyalty_points: 0,
    },
    {
        email: "tier-bronze-3@example.test",
        first_name: "Bronze",
        last_name: "Three",
        tier: "Bronze",
        spend: 1_900_000,
        loyalty_points: 0,
    },
    {
        email: "tier-silver-1@example.test",
        first_name: "Silver",
        last_name: "One",
        tier: "Silver",
        spend: 2_000_000,
        loyalty_points: 1_000,
    },
    {
        email: "tier-silver-2@example.test",
        first_name: "Silver",
        last_name: "Two",
        tier: "Silver",
        spend: 5_000_000,
        loyalty_points: 200,
    },
    {
        email: "tier-silver-3@example.test",
        first_name: "Silver",
        last_name: "Three",
        tier: "Silver",
        spend: 9_500_000,
        loyalty_points: 0,
    },
    {
        email: "tier-gold-1@example.test",
        first_name: "Gold",
        last_name: "One",
        tier: "Gold",
        spend: 10_000_000,
        loyalty_points: 2_000,
    },
    {
        email: "tier-gold-2@example.test",
        first_name: "Gold",
        last_name: "Two",
        tier: "Gold",
        spend: 15_000_000,
        loyalty_points: 500,
    },
    {
        email: "tier-gold-3@example.test",
        first_name: "Gold",
        last_name: "Three",
        tier: "Gold",
        spend: 25_000_000,
        loyalty_points: 0,
    },
];

async function getOrCreateCustomer(container: any, customer: (typeof customers)[number]) {
    const customerModule = container.resolve(Modules.CUSTOMER) as any;
    const auth = container.resolve(Modules.AUTH) as any;
    const [existing] = await customerModule.listCustomers({ email: customer.email });

    if (existing?.has_account) return existing;

    const registration = await auth.register("emailpass", {
        body: { email: customer.email, password: PASSWORD },
    });
    if (!registration.success || !registration.authIdentity) {
        throw new MedusaError(
            MedusaError.Types.DB_ERROR,
            `Không thể tạo tài khoản ${customer.email}`,
        );
    }

    const { result } = await createCustomerAccountWorkflow(container).run({
        input: {
            authIdentityId: registration.authIdentity.id,
            customerData: {
                email: customer.email,
                first_name: customer.first_name,
                last_name: customer.last_name,
            },
        },
    });
    return result;
}

// --- Helper Functions ---

/**
 * Ensures a promotion exists for the given tier fixture or creates it.
 */
async function ensurePromotion(
    promotionModule: any,
    fixture: (typeof tiers)[number],
): Promise<string | null> {
    if (!fixture.promotion_code) return null;

    const [existing] = await promotionModule.listPromotions(
        { code: fixture.promotion_code },
        { select: ["id"] },
    );
    if (existing?.id) return existing.id;

    const created = await promotionModule.createPromotions({
        code: fixture.promotion_code,
        type: "standard",
        status: "active",
        is_automatic: false,
        application_method: {
            type: "percentage",
            value: fixture.name === "Gold" ? 10 : 5,
            target_type: "items",
            allocation: "across",
        },
    });

    return created.id;
}

/**
 * Upserts a tier and its associated VND rule.
 */
async function upsertTierWithRules(
    tierService: TierModuleService,
    fixture: (typeof tiers)[number],
    promoId: string | null,
) {
    const [existing] = await tierService.listTiers({ name: fixture.name });

    const tier = existing
        ? await tierService.updateTiers({ id: existing.id, name: fixture.name, promo_id: promoId })
        : await tierService.createTiers({ name: fixture.name, promo_id: promoId });

    const [existingRule] = await tierService.listTierRules({
        tier_id: tier.id,
        currency_code: "vnd",
    });

    if (existingRule) {
        await tierService.updateTierRules({
            id: existingRule.id,
            min_purchase_value: fixture.min_purchase_value,
        });
    } else {
        await tierService.createTierRules({
            tier_id: tier.id,
            currency_code: "vnd",
            min_purchase_value: fixture.min_purchase_value,
        });
    }

    return tier;
}

/**
 * Seeds tiers and their rules sequentially.
 */
async function seedTiers(
    deps: Pick<SeedDependencies, "tierService" | "promotionModule">,
): Promise<Map<string, any>> {
    const tierByName = new Map<string, any>();

    for (const fixture of tiers) {
        const promoId = await ensurePromotion(deps.promotionModule, fixture);
        const tier = await upsertTierWithRules(deps.tierService, fixture, promoId);
        tierByName.set(fixture.name, tier);
    }

    return tierByName;
}

/**
 * Synchronizes customer tier links (dismiss old link if changed, create new link).
 */
async function syncCustomerTierLink(
    deps: Pick<SeedDependencies, "query" | "remoteLink">,
    customerId: string,
    targetTierId: string,
) {
    const { data: customerData } = await deps.query.graph({
        entity: "customer",
        fields: ["id", "tier.id"],
        filters: { id: customerId },
    });

    const currentTierId = customerData[0]?.tier?.id;
    if (currentTierId === targetTierId) return;

    const linkDescriptor = (tierId: string) => ({
        [TIER_MODULE]: { tier_id: tierId },
        [Modules.CUSTOMER]: { customer_id: customerId },
    });

    if (currentTierId) {
        await deps.remoteLink.dismiss([linkDescriptor(currentTierId)]);
    }
    await deps.remoteLink.create([linkDescriptor(targetTierId)]);
}

/**
 * Seeds customers, assigns loyalty points, and attaches appropriate tiers.
 */
async function seedCustomersWithTiers(
    container: ExecArgs["container"],
    deps: Pick<SeedDependencies, "query" | "remoteLink">,
    tierByName: Map<string, any>,
) {
    const seededCustomers: Array<{ fixture: (typeof customers)[number]; customer: any }> = [];

    for (const fixture of customers) {
        const customer = await getOrCreateCustomer(container, fixture);
        await seedLoyaltyBalance(container, customer.id, fixture.loyalty_points);
        seededCustomers.push({ fixture, customer });

        const targetTier = tierByName.get(fixture.tier);
        if (targetTier?.id) {
            await syncCustomerTierLink(deps, customer.id, targetTier.id);
        }
    }

    return seededCustomers;
}

/**
 * Fetches dependencies required for order creation.
 */
async function resolveOrderContext(
    deps: Pick<SeedDependencies, "query" | "regionModule" | "salesChannelModule">,
) {
    const [productsResult, [region], [salesChannel]] = await Promise.all([
        deps.query.graph({
            entity: "product",
            fields: ["id", "title", "variants.id"],
            pagination: { take: 1 },
        }),
        deps.regionModule.listRegions({ name: "Vietnam" }),
        deps.salesChannelModule.listSalesChannels({ name: "Default Sales Channel" }),
    ]);

    const product = productsResult.data?.[0];
    const variantId = product?.variants?.[0]?.id;

    if (!product?.id || !variantId) {
        throw new MedusaError(
            MedusaError.Types.NOT_FOUND,
            "Không tìm thấy product fixture để tạo order tier",
        );
    }

    return { product, variantId, region, salesChannel };
}

/**
 * Clears old orders and generates target tier test orders.
 */
async function seedOrders(
    deps: Pick<SeedDependencies, "orderModule" | "query" | "regionModule" | "salesChannelModule">,
    seededCustomers: Array<{ fixture: (typeof customers)[number]; customer: any }>,
) {
    const { product, variantId, region, salesChannel } = await resolveOrderContext(deps);
    const customerIds = seededCustomers.map(({ customer }) => customer.id);

    // Clear existing orders for idempotency
    const existingOrders = await deps.orderModule.listOrders(
        { customer_id: customerIds },
        { select: ["id"] },
    );

    if (existingOrders.length > 0) {
        await deps.orderModule.deleteOrders(existingOrders.map((o: { id: string }) => o.id));
    }

    // Create batch orders
    const orderPayloads = seededCustomers.map(({ fixture, customer }) => ({
        email: fixture.email,
        customer_id: customer.id,
        currency_code: "vnd",
        status: "completed",
        ...(region?.id ? { region_id: region.id } : {}),
        ...(salesChannel?.id ? { sales_channel_id: salesChannel.id } : {}),
        items: [
            {
                title: `Tier fixture ${fixture.tier}`,
                quantity: 1,
                unit_price: fixture.spend,
                product_id: product.id,
                variant_id: variantId,
            },
        ],
    }));

    await deps.orderModule.createOrders(orderPayloads);
}

// --- Main Orchestrator ---

export default async function seedCustomerTiers({ container }: ExecArgs) {
    const deps: SeedDependencies = {
        logger: container.resolve(ContainerRegistrationKeys.LOGGER),
        promotionModule: container.resolve(Modules.PROMOTION),
        tierService: container.resolve(TIER_MODULE),
        remoteLink: container.resolve(ContainerRegistrationKeys.LINK),
        query: container.resolve(ContainerRegistrationKeys.QUERY) as RemoteQueryFunction,
        orderModule: container.resolve(Modules.ORDER),
        regionModule: container.resolve(Modules.REGION),
        salesChannelModule: container.resolve(Modules.SALES_CHANNEL),
    };

    const tierByName = await seedTiers(deps);
    const seededCustomers = await seedCustomersWithTiers(container, deps, tierByName);
    await seedOrders(deps, seededCustomers);

    deps.logger.info(
        `[seed:customer-tiers] seeded ${tiers.length} tiers, ${customers.length} customers, ${customers.length} VND orders, and loyalty balances.`,
    );
    deps.logger.info(`[seed:customer-tiers] test password: ${PASSWORD}`);
}
