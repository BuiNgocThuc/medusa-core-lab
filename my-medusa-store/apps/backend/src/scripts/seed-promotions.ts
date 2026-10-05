import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils";
import {
    FLASH_CAMPAIGN_BUDGET,
    FLASH_CAMPAIGN_IDENTIFIER,
    RACKET_SUMMER_GET_SOCK_PROMOTION_CODE,
    VIP_BUNDLE_PROMOTION_CODE,
} from "@/constant";
import { CONDITIONAL_PROMOTION_MODULE, ConditionalPromotionModuleService } from "../modules/conditional-promotion";

type PromotionFixture = {
    code: string;
    type: "percentage" | "fixed";
    value: number;
    description: string;
};

type ConditionalPromotionFixture = {
    code: string;
    application_method: Record<string, unknown>;
    metadata: Record<string, string>;
};

type SeedPromotionsInput = ExecArgs & {
    category_ids?: Record<string, string>;
};

const FLASH_SEED_CODE = "FLASH20-SEED";

const PROMOTIONS: PromotionFixture[] = [
    {
        code: "FIRST_PURCHASE",
        type: "percentage",
        value: 10,
        description: "10% off a customer's first purchase",
    },
    {
        code: "TIER_SILVER",
        type: "percentage",
        value: 5,
        description: "5% off for Silver customers",
    },
    {
        code: "TIER_GOLD",
        type: "percentage",
        value: 10,
        description: "10% off for Gold customers",
    },
];

async function seedBasePromotions(promotionModule: any, logger: any) {
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

    return created;
}

async function getCategoryIds(
    query: any,
    categoryIds: Record<string, string> | undefined,
) {
    const resolvedCategoryIds = categoryIds ?? Object.fromEntries(
        (await query.graph({
            entity: "product_category",
            fields: ["id", "name"],
        })).data.map((category: { id: string; name: string }) => [category.name, category.id]),
    );

    const racketCategoryId = resolvedCategoryIds.Rackets;
    const shoesCategoryId = resolvedCategoryIds.Shoes;
    const socksCategoryId = resolvedCategoryIds.Socks;

    if (!racketCategoryId || !shoesCategoryId || !socksCategoryId) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Promotion seed requires Rackets, Shoes, and Socks categories",
        );
    }

    return { racketCategoryId, shoesCategoryId, socksCategoryId };
}

function getConditionalPromotions({
    racketCategoryId,
    shoesCategoryId,
    socksCategoryId,
}: {
    racketCategoryId: string;
    shoesCategoryId: string;
    socksCategoryId: string;
}): ConditionalPromotionFixture[] {
    return [
        {
            code: VIP_BUNDLE_PROMOTION_CODE,
            application_method: {
                type: "percentage",
                value: 15,
                target_type: "items",
                allocation: "once",
                max_quantity: 3,
                target_rules: [
                    {
                        attribute: "items.product.categories.id",
                        operator: "in",
                        values: [racketCategoryId, shoesCategoryId],
                    },
                ],
            },
            metadata: {
                description: "15% off the three lowest-priced eligible VIP bundle items",
                seed: "conditional-promotion",
            },
        },
        {
            code: RACKET_SUMMER_GET_SOCK_PROMOTION_CODE,
            application_method: {
                type: "percentage",
                value: 100,
                target_type: "items",
                allocation: "once",
                max_quantity: 1,
                target_rules: [{ attribute: "items.product.categories.id", operator: "in", values: [socksCategoryId] }],
            },
            metadata: { description: "Conditional promotion carrier", source: "conditional-promotion-engine" },
        },
    ];
}

async function seedConditionalPromotions(
    promotionModule: any,
    logger: any,
    categoryIds: {
        racketCategoryId: string;
        shoesCategoryId: string;
        socksCategoryId: string;
    },
) {
    let created = 0;
    const conditionalPromotions = getConditionalPromotions(categoryIds);

    for (const fixture of conditionalPromotions) {
        const [existing] = await promotionModule.listPromotions({ code: fixture.code });

        if (existing) {
            await promotionModule.updatePromotions({
                id: existing.id,
                status: "active",
                is_automatic: false,
                metadata: fixture.metadata,
            });
            logger.info(`[seed:promotions] ${fixture.code} exists — activated`);
            continue;
        }

        await promotionModule.createPromotions({
            code: fixture.code,
            type: "standard",
            status: "active",
            is_automatic: false,
            application_method: fixture.application_method,
            metadata: fixture.metadata,
        });
        created++;
        logger.info(`[seed:promotions] created ${fixture.code}`);
    }

    return created;
}

async function seedRacketSummerCondition(service: ConditionalPromotionModuleService, promotionModule: any, query: any, categoryIds: any) {
    const { data: collections } = await query.graph({ entity: "product_collection", fields: ["id"], filters: { handle: "summer" } })
    const collectionId = collections[0]?.id
    if (!collectionId) return
    const code = RACKET_SUMMER_GET_SOCK_PROMOTION_CODE
    const [promotion] = await promotionModule.listPromotions({ code })
    if (!promotion) return
    const [existing] = await service.listConditionalPromotions({ promo_id: promotion.id })
    const data = { promo_id: promotion.id, title: "Tặng tất khi mua vợt", description: "Mua ít nhất 2 vợt, trong đó có một vợt Summer, để nhận tất miễn phí.", terms: "Giảm 100% tối đa một sản phẩm thuộc Socks.", cta_url: null, status: "active", priority: 3, rule_tree: { version: 1, operator: "and", conditions: [{ min_quantity: 2, match: { mode: "all", clauses: [{ attribute: "category", values: [categoryIds.racketCategoryId] }] }, subset_requirements: [{ min_quantity: 1, match: { mode: "all", clauses: [{ attribute: "collection", values: [collectionId] }] } }] }] }, target: { mode: "all", clauses: [{ attribute: "category", values: [categoryIds.socksCategoryId] }] }, max_quantity: 1, placements: { category_ids: [categoryIds.racketCategoryId], collection_ids: [collectionId] } }
    if (existing) await service.updateConditionalPromotions({ id: existing.id, ...data } as any)
    else await service.createConditionalPromotions(data as any)
}

async function seedFlashCampaign(promotionModule: any, logger: any) {
    const [flashSeed] = await promotionModule.listPromotions({ code: FLASH_SEED_CODE });
    if (flashSeed) {
        await promotionModule.updatePromotions({
            id: flashSeed.id,
            status: "inactive",
            is_automatic: false,
        });
        logger.info(`[seed:promotions] ${FLASH_SEED_CODE} exists — normalized`);
        return 0;
    }

    await promotionModule.createPromotions({
        code: FLASH_SEED_CODE,
        type: "standard",
        status: "inactive",
        is_automatic: false,
        application_method: {
            type: "fixed",
            value: 1,
            currency_code: "vnd",
            target_type: "order",
            allocation: "across",
        },
        campaign: {
            name: "Flash 20 Daily",
            description: "Campaign used by per-cart Flash 20 promotions",
            campaign_identifier: FLASH_CAMPAIGN_IDENTIFIER,
            budget: {
                type: "spend",
                limit: FLASH_CAMPAIGN_BUDGET,
                currency_code: "vnd",
            },
        },
        metadata: {
            description: "Internal seed promotion. Do not expose this code to customers.",
            seed: "conditional-promotion",
        },
    });
    logger.info(`[seed:promotions] created ${FLASH_SEED_CODE} and ${FLASH_CAMPAIGN_IDENTIFIER}`);

    return 1;
}

export default async function seedPromotions({
    container,
    category_ids,
}: SeedPromotionsInput) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any;
    const promotionModule = container.resolve(Modules.PROMOTION) as any;
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any;
    const categoryIds = await getCategoryIds(query, category_ids);
    const conditionalService = container.resolve(CONDITIONAL_PROMOTION_MODULE) as ConditionalPromotionModuleService;
    const created =
        await seedBasePromotions(promotionModule, logger) +
        await seedConditionalPromotions(promotionModule, logger, categoryIds) +
        await seedFlashCampaign(promotionModule, logger);
    await seedRacketSummerCondition(conditionalService, promotionModule, query, categoryIds)

    logger.info(`[seed:promotions] done — ${created} promotion fixture(s) created`);
}
