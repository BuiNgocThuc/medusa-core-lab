import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
    CONDITIONAL_PROMOTION_MODULE,
    ConditionalPromotionModuleService,
} from "../../../../modules/conditional-promotion";
import { Modules } from "@medusajs/framework/utils";
import { ConditionalPromotionInput } from "../validators";
import { nativeTargetRules } from "../target-rules";
const promotionRelations = ["application_method", "application_method.target_rules", "application_method.target_rules.values"];

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const service = req.scope.resolve(
        CONDITIONAL_PROMOTION_MODULE,
    ) as ConditionalPromotionModuleService;
    const promotionService = req.scope.resolve(Modules.PROMOTION) as any;
    const conditional_promotion = (await service.retrieveConditionalPromotion(
        req.params.id,
    )) as any;
    const promotion = await promotionService.retrievePromotion(
        conditional_promotion.promo_id,
        { relations: promotionRelations },
    );
    res.json({ conditional_promotion, promotion });
}
export async function POST(req: MedusaRequest<ConditionalPromotionInput>, res: MedusaResponse) {
    const service = req.scope.resolve(
        CONDITIONAL_PROMOTION_MODULE,
    ) as ConditionalPromotionModuleService;
    const promotionService = req.scope.resolve(Modules.PROMOTION) as any;
    const current = (await service.retrieveConditionalPromotion(req.params.id)) as any;
    const input = req.validatedBody;
    const previous = await promotionService.retrievePromotion(
        current.promo_id,
        { relations: promotionRelations },
    );
    const previousTargetRuleIds = previous.application_method?.target_rules?.map(
        (rule: any) => rule.id,
    ) ?? [];
    try {
        await promotionService.updatePromotions({
            id: current.promo_id,
            code: input.promotion.code,
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
        if (previousTargetRuleIds.length) {
            await promotionService.removePromotionTargetRules(
                current.promo_id,
                previousTargetRuleIds,
            );
        }
        await promotionService.addPromotionTargetRules(
            current.promo_id,
            nativeTargetRules(input.promotion.target),
        );
        const conditional_promotion = await service.updateConditionalPromotions({
            id: current.id,
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
        res.json({ conditional_promotion });
    } catch (error) {
        await promotionService.updatePromotions({
            id: previous.id,
            code: previous.code,
            status: previous.status,
            application_method: previous.application_method,
            metadata: previous.metadata,
        });
        throw error;
    }
}
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const service = req.scope.resolve(
        CONDITIONAL_PROMOTION_MODULE,
    ) as ConditionalPromotionModuleService;
    const promotionService = req.scope.resolve(Modules.PROMOTION) as any;
    const current = (await service.retrieveConditionalPromotion(req.params.id)) as any;
    await promotionService.updatePromotions({ id: current.promo_id, status: "inactive" });
    await service.softDeleteConditionalPromotions(req.params.id);
    res.status(200).json({ id: current.id });
}
