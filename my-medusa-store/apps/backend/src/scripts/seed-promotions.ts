import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils";
import {
    FLASH_CAMPAIGN_BUDGET,
    FLASH_CAMPAIGN_IDENTIFIER,
    FLASH_PROMOTION_CODE_PREFIX,
    RACKET_SUMMER_GET_SOCK_PROMOTION_CODE,
    VIP_BUNDLE_PROMOTION_CODE,
} from "@/src/constant";

type PromotionFixture = {
    code: string;
    type: "percentage" | "fixed";
    value: number;
    description: string;
};

const PROMOTIONS: PromotionFixture[] = [
    {
        code: "FIRST_PURCHASE",
        type: "percentage",
        value: 10,
        description: "10% off a customer's first purchase",
    },
    {
        code: "WELCOME10",
        type: "percentage",
        value: 10,
        description: "10% off welcome promotion",
    },
    {
        code: "SAVE5",
        type: "percentage",
        value: 5,
        description: "5% off sitewide",
    },
    {
        code: "SUMMER15",
        type: "percentage",
        value: 15,
        description: "15% off summer sale",
    },
    {
        code: "WEEKEND20",
        type: "percentage",
        value: 20,
        description: "20% off weekend promotion",
    },
    {
        code: "VIP25",
        type: "percentage",
        value: 25,
        description: "25% off VIP promotion",
    },
    {
        code: "SAVE50000",
        type: "fixed",
        value: 50_000,
        description: "50,000 VND off",
    },
    {
        code: "SAVE100000",
        type: "fixed",
        value: 100_000,
        description: "100,000 VND off",
    },
    {
        code: "SAVE200000",
        type: "fixed",
        value: 200_000,
        description: "200,000 VND off",
    },
    {
        code: "FLASH30",
        type: "percentage",
        value: 30,
        description: "30% off flash sale",
    },
    {
        code: "DEMO10",
        type: "percentage",
        value: 10,
        description: "10% off demo promotion",
    },
];

export default async function seedPromotions({ container }: ExecArgs) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any;
    const promotionModule = container.resolve(Modules.PROMOTION) as any;
    let created = 0;

    for (const fixture of PROMOTIONS) {
        const [existing] = await promotionModule.listPromotions({
            code: fixture.code,
        }, { select: ["id"] });
        if (existing) {
            await promotionModule.updatePromotions({
                id: existing.id,
                status: "active",
                is_automatic: false,
            });
            logger.info(`[seed:promotions] ${fixture.code} exists — normalized`);
            continue;
        }

        await promotionModule.createPromotions({
            code: fixture.code,
            type: "standard",
            status: "active",
            is_automatic: false,
            application_method: {
                type: fixture.type,
                target_type: "items",
                allocation: "across",
                value: fixture.value,
                ...(fixture.type === "fixed" ? { currency_code: "vnd" } : {}),
            },
            metadata: { description: fixture.description, seed: "core-demo" },
        });
        created++;
        logger.info(`[seed:promotions] created ${fixture.code}`);
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any;
    const { data: categories } = await query.graph({
        entity: "product_category",
        fields: ["id", "name"],
        filters: { name: ["Rackets", "Shoes", "Socks"] },
    });
    const categoryId = (name: string) => categories.find((category: any) => category.name === name)?.id;
    const racketsId = categoryId("Rackets");
    const shoesId = categoryId("Shoes");
    const socksId = categoryId("Socks");

    if (!racketsId || !shoesId || !socksId) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Conditional promotion seed requires Rackets, Shoes, and Socks categories",
        );
    }

    const conditionalPromotions = [
        {
            code: VIP_BUNDLE_PROMOTION_CODE,
            type: "standard" as const,
            application_method: {
                type: "percentage" as const,
                value: 15,
                target_type: "items" as const,
                allocation: "once" as const,
                max_quantity: 3,
                target_rules: [{ attribute: "product_category_id", operator: "in", values: [racketsId, shoesId] }],
            },
        },
        {
            code: RACKET_SUMMER_GET_SOCK_PROMOTION_CODE,
            type: "buyget" as const,
            application_method: {
                type: "percentage" as const,
                value: 100,
                target_type: "items" as const,
                allocation: "each" as const,
                buy_rules_min_quantity: 2,
                apply_to_quantity: 1,
                max_quantity: 1,
                buy_rules: [{ attribute: "product_category_id", operator: "in", values: [racketsId] }],
                target_rules: [{ attribute: "product_category_id", operator: "in", values: [socksId] }],
            },
        },
        {
            code: `${FLASH_PROMOTION_CODE_PREFIX}SEED`,
            type: "standard" as const,
            application_method: {
                type: "fixed" as const,
                value: 1,
                currency_code: "vnd",
                target_type: "order" as const,
                allocation: "across" as const,
            },
            campaign: {
                name: "Flash Promotion daily budget",
                campaign_identifier: FLASH_CAMPAIGN_IDENTIFIER,
                budget: { type: "spend" as const, limit: FLASH_CAMPAIGN_BUDGET, currency_code: "vnd" },
            },
        },
    ];

    for (const fixture of conditionalPromotions) {
        const [existing] = await promotionModule.listPromotions({ code: fixture.code }, { select: ["id"] });
        if (existing) continue;
        await promotionModule.createPromotions({
            ...fixture,
            status: fixture.code === `${FLASH_PROMOTION_CODE_PREFIX}SEED` ? "inactive" : "active",
            is_automatic: false,
            metadata: { description: "Conditional badminton promotion", seed: "core-demo" },
        });
        created++;
    }

    logger.info(`[seed:promotions] done — ${created} created / ${PROMOTIONS.length} fixtures`);
}
