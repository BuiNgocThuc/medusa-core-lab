import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
    const cartModule = req.scope.resolve(Modules.CART) as any
    const carts = await cartModule.listCarts({ customer_id: req.auth_context.actor_id })
    const activeCart = carts
        .filter((cart: { completed_at?: Date | null }) => !cart.completed_at)
        .sort(
            (a: { updated_at?: Date }, b: { updated_at?: Date }) =>
                (b.updated_at?.getTime?.() || 0) - (a.updated_at?.getTime?.() || 0),
        )[0]

    res.json({ cart: activeCart || null })
}
