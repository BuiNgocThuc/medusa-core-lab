import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

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

    logger.info(`[seed:promotions] done — ${created} created / ${PROMOTIONS.length} fixtures`);
}
