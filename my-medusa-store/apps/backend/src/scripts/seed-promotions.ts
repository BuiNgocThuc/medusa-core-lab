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
        });
        if (existing) {
            logger.info(`[seed:promotions] ${fixture.code} exists — skip`);
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
