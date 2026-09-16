import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { applyLoyaltyOnCartWorkflow, removeLoyaltyFromCartWorkflow } from "@/src/workflows";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const { id: cart_id } = req.params;

    const { result: cart } = await applyLoyaltyOnCartWorkflow(req.scope).run({
        input: {
            cart_id,
        },
    });

    res.json({ cart });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const { id: cart_id } = req.params;

    const { result: cart } = await removeLoyaltyFromCartWorkflow(req.scope).run({
        input: {
            cart_id,
        },
    });

    res.json({ cart });
}
