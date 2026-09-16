import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type RestoreCartResponse = {
    cart: { id: string } | null
}

export async function POST(
    req: AuthenticatedMedusaRequest,
    res: MedusaResponse<RestoreCartResponse>
) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const customerId = req.auth_context?.actor_id

    // 1. Chỉ query lấy id và created_at của các cart chưa checkout
    const { data: carts } = await query.graph({
        entity: "cart",
        fields: ["id", "created_at"],
        filters: {
            customer_id: customerId,
            completed_at: null,
        },
    })

    // 2. Không có cart nào -> trả về null
    if (!carts || carts.length === 0) {
        return res.status(200).json({ cart: null })
    }

    // 3. Lấy cart mới nhất
    const latestCart = carts.reduce((latest, cart) => {
        return new Date(cart.created_at) > new Date(latest.created_at) ? cart : latest
    })

    // 4. Trả về đúng ID để Storefront set cookie!
    return res.status(200).json({ cart: { id: latestCart.id } })
}
