import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows";
import { TIER_MODULE, TierModuleService } from "@/src/modules/tier";

const PASSWORD = "supersecret";

const tiers = [
    { name: "Bronze", min_purchase_value: 0, promotion_code: null },
    { name: "Silver", min_purchase_value: 2_000_000, promotion_code: "TIER_SILVER" },
    { name: "Gold", min_purchase_value: 10_000_000, promotion_code: "TIER_GOLD" },
    { name: "VIP", min_purchase_value: 20_000_000, promotion_code: null },
];

const customers = [
    { email: "tier-bronze-1@example.test", first_name: "Bronze", last_name: "One", tier: "Bronze", spend: 100_000 },
    { email: "tier-bronze-2@example.test", first_name: "Bronze", last_name: "Two", tier: "Bronze", spend: 500_000 },
    { email: "tier-bronze-3@example.test", first_name: "Bronze", last_name: "Three", tier: "Bronze", spend: 1_900_000 },
    { email: "tier-silver-1@example.test", first_name: "Silver", last_name: "One", tier: "Silver", spend: 2_000_000 },
    { email: "tier-silver-2@example.test", first_name: "Silver", last_name: "Two", tier: "Silver", spend: 5_000_000 },
    { email: "tier-silver-3@example.test", first_name: "Silver", last_name: "Three", tier: "Silver", spend: 9_500_000 },
    { email: "tier-gold-1@example.test", first_name: "Gold", last_name: "One", tier: "Gold", spend: 10_000_000 },
    { email: "tier-gold-2@example.test", first_name: "Gold", last_name: "Two", tier: "Gold", spend: 15_000_000 },
    { email: "tier-gold-3@example.test", first_name: "Gold", last_name: "Three", tier: "Gold", spend: 25_000_000 },
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
        throw new Error(`Không thể tạo tài khoản ${customer.email}`);
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

export default async function seedCustomerTiers({ container }: ExecArgs) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any;
    const promotionModule = container.resolve(Modules.PROMOTION) as any;
    const tierService: TierModuleService = container.resolve(TIER_MODULE);
    const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK) as any;
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any;
    const orderModule = container.resolve(Modules.ORDER) as any;
    const regionModule = container.resolve(Modules.REGION) as any;
    const salesChannelModule = container.resolve(Modules.SALES_CHANNEL) as any;
    const tierByName = new Map<string, any>();

    for (const fixture of tiers) {
        let promo_id: string | null = null;
        if (fixture.promotion_code) {
            const [promotion] = await promotionModule.listPromotions(
                { code: fixture.promotion_code },
                { select: ["id"] },
            );
            promo_id = promotion?.id || null;
            if (!promo_id) {
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
                promo_id = created.id;
            }
        }

        const [existing] = await tierService.listTiers({ name: fixture.name });
        const tier = existing
            ? await tierService.updateTiers({ id: existing.id, name: fixture.name, promo_id })
            : await tierService.createTiers({ name: fixture.name, promo_id });
        const [rule] = await tierService.listTierRules({ tier_id: tier.id, currency_code: "vnd" });
        if (rule) {
            await tierService.updateTierRules({ id: rule.id, min_purchase_value: fixture.min_purchase_value });
        } else {
            await tierService.createTierRules({
                tier_id: tier.id,
                currency_code: "vnd",
                min_purchase_value: fixture.min_purchase_value,
            });
        }
        tierByName.set(fixture.name, tier);
    }

    const seededCustomers: Array<{ fixture: (typeof customers)[number]; customer: any }> = [];
    for (const fixture of customers) {
        const customer = await getOrCreateCustomer(container, fixture);
        seededCustomers.push({ fixture, customer });
        const { data: customerData } = await query.graph({
            entity: "customer",
            fields: ["id", "tier.id"],
            filters: { id: customer.id },
        });
        const currentTierId = customerData[0]?.tier?.id;
        const tier = tierByName.get(fixture.tier);

        if (currentTierId && currentTierId !== tier.id) {
            await remoteLink.dismiss([
                {
                    [TIER_MODULE]: { tier_id: currentTierId },
                    [Modules.CUSTOMER]: { customer_id: customer.id },
                },
            ]);
        }
        if (currentTierId !== tier.id) {
            await remoteLink.create([
                {
                    [TIER_MODULE]: { tier_id: tier.id },
                    [Modules.CUSTOMER]: { customer_id: customer.id },
                },
            ]);
        }
    }

    const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "title", "variants.id"],
        pagination: { take: 1 },
    });
    const product = products[0];
    if (!product?.variants?.[0]?.id) {
        throw new Error("Không tìm thấy product fixture để tạo order tier");
    }
    const [region] = await regionModule.listRegions({ name: "Vietnam" });
    const [salesChannel] = await salesChannelModule.listSalesChannels({ name: "Default Sales Channel" });
    const customerIds = seededCustomers.map(({ customer }) => customer.id);
    const existingOrders = await orderModule.listOrders({ customer_id: customerIds }, { select: ["id"] });
    if (existingOrders.length) {
        await orderModule.deleteOrders(existingOrders.map((order: { id: string }) => order.id));
    }
    await orderModule.createOrders(
        seededCustomers.map(({ fixture, customer }) => ({
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
                    variant_id: product.variants[0].id,
                },
            ],
        })),
    );

    logger.info(`[seed:customer-tiers] seeded ${tiers.length} tiers, ${customers.length} customers, and ${customers.length} VND orders.`);
    logger.info(`[seed:customer-tiers] test password: ${PASSWORD}`);
}
