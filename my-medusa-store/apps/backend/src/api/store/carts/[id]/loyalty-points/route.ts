import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import { applyLoyaltyOnCartWorkflow, removeLoyaltyFromCartWorkflow } from "@/src/workflows";
import { RedeemLoyaltyPointsInput } from "./validators";

async function assertCartOwnership(req: AuthenticatedMedusaRequest) {
    const cartModule = req.scope.resolve(Modules.CART) as any;
    const [cart] = await cartModule.listCarts({ id: req.params.id });

    if (!cart || cart.customer_id !== req.auth_context.actor_id) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found");
    }
}

export async function POST(
    req: AuthenticatedMedusaRequest<RedeemLoyaltyPointsInput>,
    res: MedusaResponse,
) {
    const { id: cart_id } = req.params;
    await assertCartOwnership(req);

    const { result: cart } = await applyLoyaltyOnCartWorkflow(req.scope).run({
        input: {
            cart_id,
            points: req.validatedBody.points,
        },
    });

    res.json({ cart });
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
    const { id: cart_id } = req.params;
    await assertCartOwnership(req);

    const { result: cart } = await removeLoyaltyFromCartWorkflow(req.scope).run({
        input: {
            cart_id,
        },
    });

    res.json({ cart });
}
