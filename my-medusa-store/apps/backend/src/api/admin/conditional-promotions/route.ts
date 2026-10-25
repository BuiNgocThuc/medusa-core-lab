import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import {
    CONDITIONAL_PROMOTION_MODULE,
    ConditionalPromotionModuleService,
} from "../../../modules/conditional-promotion";
import { ConditionalPromotionInput } from "./validators";
import { nativeTargetRules } from "./target-rules";
const promotionRelations = [
    "application_method",
    "application_method.target_rules",
    "application_method.target_rules.values",
];
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const service = req.scope.resolve(
        CONDITIONAL_PROMOTION_MODULE,
    ) as ConditionalPromotionModuleService;
    const promotionService = req.scope.resolve(Modules.PROMOTION) as any;
    const [conditional_promotions, count] = await service.listAndCountConditionalPromotions(
        {},
        { take: 50, order: { priority: "DESC" } },
    );
    const promotions = conditional_promotions.length
        ? await promotionService.listPromotions(
              { id: conditional_promotions.map((promotion) => promotion.promo_id) },
              { relations: promotionRelations },
          )
        : [];
    const promotionsById = new Map(promotions.map((promotion: any) => [promotion.id, promotion]));
    res.json({
        conditional_promotions: conditional_promotions.map((promotion) => {
            const carrier = promotionsById.get(promotion.promo_id) as any;
            return {
                ...promotion,
                code: carrier?.code,
                percentage: carrier?.application_method?.value,
            };
        }),
        count,
    });
}
export async function POST(req: MedusaRequest<ConditionalPromotionInput>, res: MedusaResponse) {
    const promotionService = req.scope.resolve(Modules.PROMOTION) as any;
    const conditionalService = req.scope.resolve(
        CONDITIONAL_PROMOTION_MODULE,
    ) as ConditionalPromotionModuleService;
    const input = req.validatedBody;
    const promotion = await promotionService.createPromotions({
        code: input.promotion.code,
        type: "standard",
        status: input.status,
        is_automatic: false,
        application_method: {
            type: "percentage",
            value: input.promotion.percentage,
            target_type: "items",
            allocation: "once",
            max_quantity: input.promotion.max_quantity,
        },
        metadata: { source: "conditional-promotion-engine" },
    });
    await promotionService.addPromotionTargetRules(
        promotion.id,
        nativeTargetRules(input.promotion.target),
    );
    const conditional_promotion = await conditionalService.createConditionalPromotions({
        promo_id: promotion.id,
        title: input.title,
        description: input.description ?? null,
        terms: input.terms ?? null,
        cta_url: input.cta_url ?? null,
        status: input.status,
        priority: input.priority,
        rule_tree: input.rule_tree as any,
        target: input.promotion.target as any,
        max_quantity: input.promotion.max_quantity,
        placements: input.placements ?? { category_ids: [], collection_ids: [] },
    } as any);
    res.status(201).json({ conditional_promotion });
}
