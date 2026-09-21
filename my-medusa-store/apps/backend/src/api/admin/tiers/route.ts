import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { CreateTierInput } from "./validators";
import { createTierWorkflow } from "@/src/workflows";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export async function POST(req: MedusaRequest<CreateTierInput>, res: MedusaResponse) {
    const { name, promo_id, tier_rules } = req.validatedBody;

    const { result } = await createTierWorkflow(req.scope).run({
        input: {
            name,
            promo_id: promo_id || null,
            tier_rules: tier_rules || [],
        },
    });

    res.json({ tier: result.tier });
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

    const { data: tiers, metadata } = await query.graph({
        entity: "tier",
        ...req.queryConfig,
    });

    res.json({
        tiers,
        count: metadata?.count || 0,
        offset: metadata?.skip || 0,
        limit: metadata?.take || 15,
    });
}
