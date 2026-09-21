import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateTierWorkflow } from "@/src/workflows";
import { UpdateTierInput } from "./validators";

// retrieve by id
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const { id } = req.params;

    const { data: tiers } = await query.graph(
        {
            entity: "tier",
            filters: {
                id,
            },
            ...req.queryConfig,
        },
        {
            throwIfKeyNotFound: true,
        },
    );

    res.json({ tier: tiers[0] });
}

// update
export async function POST(
    req: MedusaRequest<UpdateTierInput>,
    res: MedusaResponse,
): Promise<void> {
    const { id } = req.params;
    const { name, promo_id, tier_rules } = req.validatedBody;

    const { result } = await updateTierWorkflow(req.scope).run({
        input: {
            id,
            name,
            promo_id: promo_id !== undefined ? promo_id : null,
            tier_rules: tier_rules || [],
        },
    });

    res.json({ tier: result.tier });
}
